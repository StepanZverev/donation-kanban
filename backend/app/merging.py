"""
Объединение карточек одного донатера.

Ситуация: Вася задонатил с задачей, потом задонатил ещё раз. Карточки Васи можно
слить в одну: суммы сложатся, тексты допишутся в конец через строку-разделитель
(фронт рисует её пунктиром), а слитые карточки уйдут в историю с пометкой «объединена».

Объединять можно любые карточки на доске с одинаковым ником (без учёта регистра),
в какой бы колонке они ни лежали. История не участвует.

«Разъединить» возвращает слитые карточки на доску, в те колонки, где они были,
и вычитает их суммы и тексты из основной карточки.
"""

import sqlite3

from fastapi import HTTPException

from .board import (
    EMPTY_MESSAGE_TITLE,
    archive_card,
    get_card,
    get_column_id_by_kind,
    get_columns,
    return_to_board,
)
from .db import get_setting, now
from .schemas import Card

# Ключ в таблице settings: объединять ли новые донаты автоматически ("1" — да)
AUTO_MERGE_KEY = "auto_merge"

# Если валюты двух донатов разные (рубли и доллары), сумму считаем в валюте стримера.
# Пока считаем, что стример получает рубли — как в DonationAlerts по умолчанию.
STREAMER_CURRENCY = "RUB"

# Строка-разделитель между текстами объединённых донатов.
# Фронт находит её в описании и рисует вместо неё пунктирную линию (CardItem).
# Символ редкий, чтобы случайно не встретился в обычном тексте.
MERGE_SEPARATOR = "⸻"


def is_auto_merge_enabled(db: sqlite3.Connection) -> bool:
    return get_setting(db, AUTO_MERGE_KEY) == "1"


def is_same_donor(card: Card, other: Card) -> bool:
    """
    Один ли донатер у двух карточек. Ник сравниваем без учёта регистра: «Вася» = «вася».
    Делаем это в Python, а не в SQL: LOWER() в SQLite понимает только латиницу.
    Это же правило повторяет фронт (utils/merging.ts).
    """
    if card.donor_name is None or other.donor_name is None:
        return False
    return card.donor_name.casefold() == other.donor_name.casefold()


def find_same_donor_cards(db: sqlite3.Connection, card: Card) -> list[Card]:
    """Другие карточки того же донатера на доске, от старых к новым."""
    rows = db.execute(
        "SELECT * FROM cards WHERE archived_at IS NULL AND id != ? ORDER BY created_at, id",
        (card.id,),
    ).fetchall()
    return [Card(**row) for row in rows if is_same_donor(card, Card(**row))]


def find_auto_merge_target(db: sqlite3.Connection, card: Card) -> Card | None:
    """
    Куда автоматически слить новый донат, или None, если некуда:
    - в карточку донатера в промежуточной колонке (например, «В работе»), самую старую из таких;
    - иначе в его самую старую карточку в «Очереди».
    В «Выполнено» не сливаем: иначе новая просьба затерялась бы среди сделанного.
    """
    kinds = {column.id: column.kind for column in get_columns(db)}
    same_donor = find_same_donor_cards(db, card)
    for kind in ("work", "incoming"):
        for other in same_donor:
            if kinds.get(other.column_id) == kind:
                return other
    return None


def merge_cards(db: sqlite3.Connection, target: Card, card_ids: list[int]) -> Card:
    """
    Сливает карточки card_ids в target. Все они должны быть на доске и от того же донатера.
    Возвращает target после слияния.
    """
    cards = [get_card(db, card_id) for card_id in card_ids]
    for card in [target, *cards]:
        if card.archived_at is not None:
            raise HTTPException(status_code=400, detail="Карточка уже в истории")
    for card in cards:
        if card.id == target.id or not is_same_donor(card, target):
            raise HTTPException(status_code=400, detail="Объединять можно только карточки одного донатера")

    # Сливаем от старых к новым, чтобы тексты шли по порядку
    for card in sorted(cards, key=lambda card: (card.created_at, card.id)):
        merge_one(db, get_card(db, target.id), card)
    return get_card(db, target.id)


def merge_one(db: sqlite3.Connection, target: Card, card: Card) -> None:
    """Сливает одну карточку card в target."""
    # Сумма. Валюта та же — просто складываем. Разные — переходим на валюту стримера.
    if target.currency == card.currency:
        amount = (target.amount or 0) + (card.amount or 0)
        currency = target.currency
    else:
        amount = (target.streamer_amount or 0) + (card.streamer_amount or 0)
        currency = STREAMER_CURRENCY
    streamer_amount = (target.streamer_amount or 0) + (card.streamer_amount or 0)

    # Текст: старый текст основной карточки, ниже разделитель и текст второго доната.
    # Если у одного из донатов текста нет, разделитель не нужен.
    description = join_texts(card_text(target), card_text(card))

    db.execute(
        """
        UPDATE cards
        SET amount = ?, currency = ?, streamer_amount = ?, description = ?,
            merge_count = merge_count + ?, updated_at = ?
        WHERE id = ?
        """,
        (amount, currency, streamer_amount, description, card.merge_count, now(), target.id),
    )

    # Слитая карточка уходит в историю со ссылкой на основную — ничего не теряется.
    # Колонку она запоминает: «Разъединить» вернёт её туда же.
    archive_card(db, card.id, "merged")
    db.execute("UPDATE cards SET merged_into_id = ? WHERE id = ?", (target.id, card.id))


def split_cards(db: sqlite3.Connection, target: Card, card_ids: list[int] | None) -> list[Card]:
    """
    «Разъединить»: возвращает на доску карточки, слитые в target.
    card_ids — какие именно (так работает «Отменить» сразу после объединения),
    None — все. Возвращает вернувшиеся карточки.
    """
    rows = db.execute(
        """
        SELECT * FROM cards
        WHERE merged_into_id = ? AND archive_reason = 'merged'
        ORDER BY archived_at DESC, id DESC
        """,
        (target.id,),
    ).fetchall()
    merged = [Card(**row) for row in rows if card_ids is None or row["id"] in card_ids]
    if not merged:
        raise HTTPException(status_code=400, detail="Карточка ни с чем не объединена")

    column_ids = {column.id for column in get_columns(db)}
    for card in merged:
        unmerge_card(db, card)
        # Колонку, где карточка была, могли удалить — тогда в «Очередь»
        if card.column_id in column_ids:
            column_id = card.column_id
        else:
            column_id = get_column_id_by_kind(db, "incoming")
        return_to_board(db, card.id, column_id)
    return [get_card(db, card.id) for card in merged]


def unmerge_card(db: sqlite3.Connection, card: Card) -> None:
    """
    Отменяет слияние card: вычитает её сумму из основной карточки и убирает её текст.
    Саму card на доску возвращает тот, кто вызвал.

    Если основную карточку успели отредактировать и текста card в ней уже нет,
    текст не трогаем — вычитаем только сумму.
    """
    row = db.execute("SELECT * FROM cards WHERE id = ?", (card.merged_into_id,)).fetchone()
    if row is None:
        # Основную карточку уже удалили навсегда — вычитать не из чего
        db.execute("UPDATE cards SET merged_into_id = NULL WHERE id = ?", (card.id,))
        return
    target = Card(**row)

    if target.currency == card.currency:
        amount = (target.amount or 0) - (card.amount or 0)
    else:
        # Основная карточка уже в валюте стримера (см. merge_one)
        amount = (target.amount or 0) - (card.streamer_amount or 0)
    streamer_amount = (target.streamer_amount or 0) - (card.streamer_amount or 0)

    description = remove_text(target.description, card_text(card))
    # Если остался только заголовок карточки, значит описание было пустым
    if description == target.title:
        description = ""

    db.execute(
        """
        UPDATE cards
        SET amount = ?, streamer_amount = ?, description = ?, merge_count = merge_count - ?, updated_at = ?
        WHERE id = ?
        """,
        (amount, streamer_amount, description, card.merge_count, now(), target.id),
    )
    db.execute("UPDATE cards SET merged_into_id = NULL WHERE id = ?", (card.id,))


def card_text(card: Card) -> str:
    """
    Текст доната, как его видно на карточке: описание, а если его нет — заголовок.
    У доната без сообщения текста нет (заголовок там служебный).
    """
    if card.description:
        return card.description
    if card.title == EMPTY_MESSAGE_TITLE:
        return ""
    return card.title


def join_texts(base_text: str, added_text: str) -> str:
    """
    Склеивает тексты двух донатов:
        текст первого
        ⸻
        текст второго
    Если один из текстов пустой, разделитель не ставим — остаётся только другой текст.
    """
    if base_text and added_text:
        return f"{base_text}\n{MERGE_SEPARATOR}\n{added_text}"
    return base_text or added_text


def remove_text(description: str, text: str) -> str:
    """
    Убирает из склеенного описания кусок text — обратное к join_texts.
    Описание режем по разделителям на части и ищем text среди них с конца:
    так он найдётся, даже если после него успели дописать другие донаты.
    Не нашли (описание отредактировали) — возвращаем описание как было.
    """
    if not text:
        return description
    parts = description.split(f"\n{MERGE_SEPARATOR}\n")
    # Текст сам может быть склеенным (слили карточку, в которую до этого что-то слили)
    text_parts = text.split(f"\n{MERGE_SEPARATOR}\n")
    size = len(text_parts)
    for start in range(len(parts) - size, -1, -1):
        if parts[start : start + size] == text_parts:
            rest = parts[:start] + parts[start + size :]
            return f"\n{MERGE_SEPARATOR}\n".join(rest)
    return description
