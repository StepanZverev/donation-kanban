"""
Общие операции с доской, которые нужны и карточкам, и истории.

У каждого пользователя своя доска. Она создаётся сама, когда пользователь впервые
что-то открывает на сайте. В каждом эндпоинте доски есть параметр
`board_id: int = Depends(get_board_id)` — FastAPI сам находит доску того,
кто прислал запрос.

Почти каждая функция ниже принимает board_id и ищет только внутри этой доски:
карточку или колонку чужой доски она «не найдёт» и ответит 404.
"""

import sqlite3

from fastapi import Depends, HTTPException

from .db import create_default_columns, get_db, now
from .schemas import BoardColumn, Card
from .users import get_current_user

# Заголовок карточки доната, если донатер ничего не написал
EMPTY_MESSAGE_TITLE = "Донат без сообщения"


def create_board(db: sqlite3.Connection, owner_id: int | None) -> int:
    """
    Создаёт пользователю доску с колонками по умолчанию и возвращает её id.
    owner_id = None — доска без хозяина: её заберёт первый, кто откроет сайт.
    """
    cursor = db.execute("INSERT INTO boards (owner_id, created_at) VALUES (?, ?)", (owner_id, now()))
    create_default_columns(db, cursor.lastrowid)
    return cursor.lastrowid


def find_user_board(db: sqlite3.Connection, user_id: int) -> int | None:
    """id доски пользователя или None, если доски у него ещё нет."""
    row = db.execute("SELECT id FROM boards WHERE owner_id = ? ORDER BY id LIMIT 1", (user_id,)).fetchone()
    return row["id"] if row else None


def get_board_id(
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> int:
    """Доска того, кто прислал запрос. Подключается так: `board_id = Depends(get_board_id)`."""
    return find_or_create_user_board(db, user["id"])


def find_or_create_user_board(db: sqlite3.Connection, user_id: int) -> int:
    """
    id доски пользователя. Если доски ещё нет:
    - есть старая доска без хозяина (база из времён, когда доска была одна) — забираем её;
    - иначе создаём новую.
    """
    board_id = find_user_board(db, user_id)
    if board_id is not None:
        return board_id

    ownerless = db.execute("SELECT id FROM boards WHERE owner_id IS NULL ORDER BY id LIMIT 1").fetchone()
    if ownerless is not None:
        db.execute("UPDATE boards SET owner_id = ? WHERE id = ?", (user_id, ownerless["id"]))
        return ownerless["id"]
    return create_board(db, user_id)


def move_cards_to_board(db: sqlite3.Connection, from_board_id: int, to_board_id: int) -> None:
    """
    Переносит все карточки (с доски и из истории) с одной доски на другую и удаляет
    опустевшую доску. Так гость, который поработал и потом вошёл в свой аккаунт
    через DonationAlerts, не теряет карточки.

    Колонки сопоставляем по виду: «Очередь» → «Очередь», «Выполнено» → «Выполнено»,
    промежуточные → в первую промежуточную (а если её нет — в «Очередь»).
    """
    work_column_ids = [column.id for column in get_columns(db, to_board_id) if column.kind == "work"]
    incoming_id = get_column_id_by_kind(db, to_board_id, "incoming")
    target_by_kind = {
        "incoming": incoming_id,
        "work": work_column_ids[0] if work_column_ids else incoming_id,
        "done": get_column_id_by_kind(db, to_board_id, "done"),
    }
    for column in get_columns(db, from_board_id):
        db.execute(
            "UPDATE cards SET board_id = ?, column_id = ? WHERE board_id = ? AND column_id = ?",
            (to_board_id, target_by_kind[column.kind], from_board_id, column.id),
        )
    # Карточки без колонки (такие бывают только в старых базах) — в «Очередь»
    db.execute(
        "UPDATE cards SET board_id = ?, column_id = ? WHERE board_id = ?",
        (to_board_id, incoming_id, from_board_id),
    )

    db.execute("DELETE FROM board_columns WHERE board_id = ?", (from_board_id,))
    db.execute("DELETE FROM board_settings WHERE board_id = ?", (from_board_id,))
    db.execute("DELETE FROM boards WHERE id = ?", (from_board_id,))


def get_card(db: sqlite3.Connection, board_id: int, card_id: int) -> Card:
    """Находит карточку доски по id или отвечает фронту ошибкой 404 «не найдено»."""
    row = db.execute("SELECT * FROM cards WHERE id = ? AND board_id = ?", (card_id, board_id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Карточка не найдена")
    return Card(**row)


def get_columns(db: sqlite3.Connection, board_id: int) -> list[BoardColumn]:
    """Все колонки доски слева направо."""
    rows = db.execute(
        "SELECT * FROM board_columns WHERE board_id = ? ORDER BY position, id", (board_id,)
    ).fetchall()
    return [BoardColumn(**row) for row in rows]


def get_column(db: sqlite3.Connection, board_id: int, column_id: int) -> BoardColumn:
    """Находит колонку доски по id или отвечает ошибкой 404."""
    row = db.execute(
        "SELECT * FROM board_columns WHERE id = ? AND board_id = ?", (column_id, board_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Колонка не найдена")
    return BoardColumn(**row)


def get_column_id_by_kind(db: sqlite3.Connection, board_id: int, kind: str) -> int:
    """id колонки доски нужного вида, например «Очереди» (kind = 'incoming')."""
    row = db.execute(
        "SELECT id FROM board_columns WHERE board_id = ? AND kind = ? ORDER BY position, id LIMIT 1",
        (board_id, kind),
    ).fetchone()
    return row["id"]


def sort_column_cards(column: BoardColumn, cards: list[Card]) -> list[Card]:
    """
    Порядок карточек внутри колонки, сверху вниз.

    В «Выполнено» сверху то, что выполнили последним.
    В остальных колонках сверху самый крупный донат, а при одинаковой сумме — тот,
    что пришёл раньше. Ручные карточки (без доната) считаются суммой 0.
    """
    if column.kind == "done":
        return sorted(cards, key=lambda card: card.moved_at, reverse=True)

    return sorted(cards, key=lambda card: (-(card.streamer_amount or 0), card.created_at, card.id))


def get_board_cards(db: sqlite3.Connection, board_id: int) -> list[Card]:
    """
    Все карточки на доске (без истории): колонка за колонкой слева направо,
    внутри колонки — в том порядке, в каком их показывать сверху вниз.
    """
    rows = db.execute(
        "SELECT * FROM cards WHERE board_id = ? AND archived_at IS NULL", (board_id,)
    ).fetchall()
    cards = [Card(**row) for row in rows]
    add_last_donation_times(db, board_id, cards)

    result: list[Card] = []
    for column in get_columns(db, board_id):
        column_cards = [card for card in cards if card.column_id == column.id]
        result.extend(sort_column_cards(column, column_cards))
    return result


def archive_card(db: sqlite3.Connection, card_id: int, reason: str, note: str | None = None) -> None:
    """
    Убирает карточку с доски в историю. reason: 'done' (выполнена), 'deleted' (выкинута),
    'rejected' (отклонена) и т. д. note — пояснение к пометке, например причина отказа.
    Карточку перед этим уже нашли на этой доске (get_card), здесь доску не проверяем.
    """
    timestamp = now()
    db.execute(
        "UPDATE cards SET archived_at = ?, archive_reason = ?, archive_note = ?, updated_at = ?"
        " WHERE id = ?",
        (timestamp, reason, note or None, timestamp, card_id),
    )


def return_to_board(db: sqlite3.Connection, card_id: int, column_id: int) -> None:
    """
    Возвращает карточку из истории на доску в колонку column_id.
    Карточку и колонку перед этим уже нашли на этой доске, здесь не проверяем.
    """
    timestamp = now()
    db.execute(
        """
        UPDATE cards
        SET archived_at = NULL, archive_reason = NULL, archive_note = NULL,
            column_id = ?, moved_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (column_id, timestamp, timestamp, card_id),
    )


def add_last_donation_times(db: sqlite3.Connection, board_id: int, cards: list[Card]) -> None:
    """
    Заполняет у карточек last_donation_at — когда пришёл их последний донат.

    У обычной карточки это время её создания. У объединённой — самое позднее время
    среди неё самой и всех слитых в неё карточек (они лежат в истории с пометкой merged
    и ссылкой merged_into_id). Слитая карточка могла и сама быть объединённой,
    поэтому идём по ссылкам вглубь.

    Заодно заполняет last_merged_at — когда в карточку последний раз что-то слили.
    Это время, когда слитая карточка ушла в историю (archived_at). Фронт по нему
    подсвечивает карточку после слияния.
    """
    rows = db.execute(
        "SELECT id, merged_into_id, created_at, archived_at FROM cards"
        " WHERE board_id = ? AND archive_reason = 'merged'",
        (board_id,),
    ).fetchall()
    # Для каждой карточки — список слитых в неё: id основной → [(id слитой, время создания)]
    merged_into: dict[int, list[tuple[int, str]]] = {}
    for row in rows:
        merged_into.setdefault(row["merged_into_id"], []).append((row["id"], row["created_at"]))
    # Когда в карточку слили последнюю: id основной → самое позднее archived_at слитых в неё
    last_merge: dict[int, str] = {}
    for row in rows:
        target_id = row["merged_into_id"]
        last_merge[target_id] = max(last_merge.get(target_id, ""), row["archived_at"])

    def latest(card_id: int, created_at: str) -> str:
        times = [created_at]
        for child_id, child_created_at in merged_into.get(card_id, []):
            times.append(latest(child_id, child_created_at))
        # Время записано строкой в одном формате (ISO), поэтому строки сравниваются как время
        return max(times)

    for card in cards:
        card.last_donation_at = latest(card.id, card.created_at)
        card.last_merged_at = last_merge.get(card.id)
