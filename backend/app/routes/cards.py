"""
Эндпоинты карточек на доске.

Каждая функция ниже — это один адрес API. Декоратор над функцией
(@router.get, @router.post …) говорит, какой HTTP-метод и путь она обслуживает.
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import (
    add_last_donation_times,
    archive_card,
    get_card,
    get_column,
    get_column_id_by_kind,
    get_columns,
    sort_column_cards,
)
from ..db import get_db, now
from ..donations import split_message
from ..merging import STREAMER_CURRENCY, merge_cards, split_cards
from ..realtime import notify_board_changed
from ..schemas import (
    Card,
    CardArchive,
    CardCreate,
    CardMerge,
    CardMove,
    CardUnmerge,
    CardUpdate,
    LatestDonations,
)

router = APIRouter(prefix="/api/cards", tags=["Карточки"])


@router.get("")
def list_cards(db: sqlite3.Connection = Depends(get_db)) -> list[Card]:
    """
    Все карточки на доске (без истории): колонка за колонкой слева направо,
    внутри колонки — в том порядке, в каком их показывать сверху вниз.
    """
    rows = db.execute("SELECT * FROM cards WHERE archived_at IS NULL").fetchall()
    cards = [Card(**row) for row in rows]
    add_last_donation_times(db, cards)

    result: list[Card] = []
    for column in get_columns(db):
        column_cards = [card for card in cards if card.column_id == column.id]
        result.extend(sort_column_cards(column, column_cards))
    return result


@router.get("/latest-donations")
def latest_donations(db: sqlite3.Connection = Depends(get_db)) -> LatestDonations:
    """
    Когда пришёл самый свежий донат на доску и самый свежий отсеянный (сразу в историю).
    Отсеянный донат узнаём по тому, что его отклонили в момент создания.
    """
    row = db.execute(
        """
        SELECT
            MAX(CASE WHEN is_filtered THEN NULL ELSE created_at END) AS on_board,
            MAX(CASE WHEN is_filtered THEN created_at END) AS to_history
        FROM (
            SELECT created_at, archive_reason = 'rejected' AND archived_at = created_at AS is_filtered
            FROM cards
            WHERE source = 'donationalerts'
        )
        """
    ).fetchone()
    return LatestDonations(on_board=row["on_board"], to_history=row["to_history"])


@router.post("", status_code=201)
def create_card(data: CardCreate, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Создаёт карточку вручную. Если колонку не указали — в «Очередь»."""
    if data.column_id is None:
        column_id = get_column_id_by_kind(db, "incoming")
    else:
        column_id = get_column(db, data.column_id).id

    donor_name = clean_donor_name(data.donor_name)
    if not donor_name and not data.text.strip():
        raise HTTPException(status_code=422, detail="Нужен ник или текст")
    # Как у доната: короткий текст — заголовок, длинный обрезается в заголовке,
    # а целиком лежит в описании (см. split_message)
    title, description = split_message(data.text)

    timestamp = now()
    # Сумму ручной карточки стример пишет в своей валюте
    currency = STREAMER_CURRENCY if data.amount is not None else None
    cursor = db.execute(
        """
        INSERT INTO cards (
            title, description, column_id, source, donor_name, amount, currency, streamer_amount,
            created_at, updated_at, moved_at
        )
        VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            description,
            column_id,
            donor_name,
            data.amount,
            currency,
            data.amount,
            timestamp,
            timestamp,
            timestamp,
        ),
    )
    notify_board_changed(db)
    return get_card(db, cursor.lastrowid)


@router.post("/clear-done")
def clear_done(db: sqlite3.Connection = Depends(get_db)) -> dict[str, int]:
    """Веник у «Выполнено»: все карточки оттуда уходят в историю как выполненные."""
    return {"cleared": clear_column(db, "done", "done")}


@router.post("/clear-queue")
def clear_queue(db: sqlite3.Connection = Depends(get_db)) -> dict[str, int]:
    """Веник у «Очереди»: все карточки оттуда уходят в историю как удалённые."""
    return {"cleared": clear_column(db, "incoming", "deleted")}


def clear_column(db: sqlite3.Connection, kind: str, reason: str) -> int:
    """Убирает в историю все карточки колонки вида kind с пометкой reason. Возвращает, сколько убрали."""
    column_id = get_column_id_by_kind(db, kind)
    rows = db.execute(
        "SELECT id FROM cards WHERE column_id = ? AND archived_at IS NULL", (column_id,)
    ).fetchall()
    for row in rows:
        archive_card(db, row["id"], reason)

    notify_board_changed(db)
    return len(rows)


@router.patch("/{card_id}")
def update_card(card_id: int, data: CardUpdate, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Редактирует ник, текст и сумму. Что не прислали, не меняется."""
    card = get_card(db, card_id)
    # model_fields_set — поля, которые фронт прислал. Так отличаем «не прислал»
    # от «прислал null» (стереть ник или сумму).
    sent = data.model_fields_set

    donor_name = clean_donor_name(data.donor_name) if "donor_name" in sent else card.donor_name
    # У доната ник стираем до пустой строки: так хранится аноним
    if donor_name is None and card.source == "donationalerts":
        donor_name = ""

    title, description = card.title, card.description
    if data.text is not None:
        title, description = split_message(data.text)

    amount, currency, streamer_amount = card.amount, card.currency, card.streamer_amount
    if "amount" in sent:
        amount, currency, streamer_amount = new_amount_fields(card, data.amount)

    db.execute(
        """
        UPDATE cards
        SET title = ?, description = ?, donor_name = ?,
            amount = ?, currency = ?, streamer_amount = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            title,
            description,
            donor_name,
            amount,
            currency,
            streamer_amount,
            now(),
            card_id,
        ),
    )
    notify_board_changed(db)
    return get_card(db, card_id)


def clean_donor_name(name: str | None) -> str | None:
    """Ник без пробелов по краям. Пустой ник у ручной карточки — значит ника нет."""
    if name is None:
        return None
    return name.strip() or None


def new_amount_fields(card: Card, amount: float | None) -> tuple[float | None, str | None, float | None]:
    """
    Новая сумма карточки → (amount, currency, streamer_amount).

    Сумму пишут в валюте карточки. Если это не валюта стримера (донат в долларах),
    сумму в валюте стримера пересчитываем по тому же курсу, что был у доната:
    было 5 $ = 450 ₽, стало 10 $ — значит 900 ₽. По ней сортируем и считаем итоги.
    """
    if amount is None:
        return None, None, None
    if card.currency is None or card.currency == STREAMER_CURRENCY or not card.amount:
        return amount, card.currency or STREAMER_CURRENCY, amount
    rate = (card.streamer_amount or card.amount) / card.amount
    return amount, card.currency, round(amount * rate, 2)


@router.post("/{card_id}/move")
def move_card(card_id: int, data: CardMove, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Переносит карточку в любую колонку, без ограничений по направлению:
    например, из «Очереди» сразу в «Выполнено» или из «Выполнено» обратно.
    """
    get_card(db, card_id)
    column = get_column(db, data.column_id)

    timestamp = now()
    db.execute(
        "UPDATE cards SET column_id = ?, moved_at = ?, updated_at = ? WHERE id = ?",
        (column.id, timestamp, timestamp, card_id),
    )
    notify_board_changed(db)
    return get_card(db, card_id)


@router.post("/{card_id}/archive")
def archive(card_id: int, data: CardArchive, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Убирает карточку в историю с явной пометкой: «выполнено», «удалено» или «отклонено»
    (с причиной), из какой бы колонки её ни взяли. Это перетаскивание в зоны по краям доски
    и «Отклонить» в меню карточки.
    """
    get_card(db, card_id)
    # Причина нужна только у «Отклонено», у остальных пометок её не сохраняем
    note = data.note.strip() if data.reason == "rejected" else None
    archive_card(db, card_id, data.reason, note)

    notify_board_changed(db)
    return get_card(db, card_id)


@router.post("/{card_id}/merge")
def merge(card_id: int, data: CardMerge, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Сливает карточки data.card_ids в эту карточку. Все они должны быть от того же донатера.
    Так работают «Объединить все донаты в эту карточку» и перетаскивание карточки на карточку.
    """
    target = merge_cards(db, get_card(db, card_id), data.card_ids)

    notify_board_changed(db)
    return target


@router.post("/{card_id}/unmerge")
def unmerge(card_id: int, data: CardUnmerge, db: sqlite3.Connection = Depends(get_db)) -> list[Card]:
    """
    «Разъединить»: возвращает слитые в эту карточку карточки на доску в ту же колонку.
    Если card_ids прислали — только эти и туда, где они были до объединения
    (так работает «Отменить» после объединения). Возвращает вернувшиеся карточки.
    """
    restored = split_cards(db, get_card(db, card_id), data.card_ids)

    notify_board_changed(db)
    return restored


@router.delete("/{card_id}")
def remove_card(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Убирает карточку с доски в историю (насовсем она не удаляется).
    Если карточка была в «Выполнено», в истории пометим её как выполненную,
    иначе — как удалённую.
    """
    card = get_card(db, card_id)
    done_column_id = get_column_id_by_kind(db, "done")
    reason = "done" if card.column_id == done_column_id else "deleted"
    archive_card(db, card_id, reason)

    notify_board_changed(db)
    return get_card(db, card_id)
