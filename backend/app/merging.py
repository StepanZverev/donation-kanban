"""
Объединение карточек одного донатера.

Ситуация: Вася задонатил с задачей, потом задонатил ещё раз. Вторую карточку
можно слить в первую: суммы сложатся, текст второго доната допишется в конец
через строку-разделитель (фронт рисует её пунктиром), а сама вторая карточка уйдёт в историю с пометкой «объединена».

Куда сливаем (основная карточка):
- если у донатера есть карточка в промежуточной колонке (например, «В работе») — в неё;
- иначе в его самую старую карточку в «Очереди».
Сливать можно только карточку из «Очереди». «Выполнено» и история не участвуют.
"""

import sqlite3

from fastapi import HTTPException

from .board import EMPTY_MESSAGE_TITLE, archive_card, get_card, get_columns
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

# Значки валют для подписи «+300 ₽ от Васи»
CURRENCY_SIGNS = {"RUB": "₽", "USD": "$", "EUR": "€"}


def is_auto_merge_enabled(db: sqlite3.Connection) -> bool:
    return get_setting(db, AUTO_MERGE_KEY) == "1"


def find_merge_target(db: sqlite3.Connection, card: Card) -> Card | None:
    """
    Находит карточку, в которую можно слить card, или None, если сливать некуда.
    Это же правило повторяет фронт (utils/merging.ts), чтобы знать, показывать ли кнопку.
    """
    kinds = {column.id: column.kind for column in get_columns(db)}
    if card.donor_name is None or kinds.get(card.column_id) != "incoming":
        return None

    # Карточки того же донатера на доске, от старых к новым.
    # Ник сравниваем без учёта регистра: «Вася» = «вася». Делаем это в Python, а не в SQL:
    # LOWER() в SQLite понимает только латиницу.
    rows = db.execute(
        "SELECT * FROM cards WHERE archived_at IS NULL AND id != ? ORDER BY created_at, id",
        (card.id,),
    ).fetchall()
    donor = card.donor_name.casefold()
    same_donor = [Card(**row) for row in rows if (row["donor_name"] or "").casefold() == donor]

    # 1. Карточка в промежуточной колонке — самая старая из таких
    for other in same_donor:
        if kinds.get(other.column_id) == "work":
            return other

    # 2. Самая старая карточка в «Очереди», если она старше нашей
    for other in same_donor:
        if kinds.get(other.column_id) == "incoming" and (other.created_at, other.id) < (card.created_at, card.id):
            return other

    return None


def merge_card(db: sqlite3.Connection, card: Card) -> Card:
    """Сливает card в основную карточку донатера. Возвращает основную карточку после слияния."""
    target = find_merge_target(db, card)
    if target is None:
        raise HTTPException(status_code=400, detail="Эту карточку не с чем объединить")

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

    added_money = format_money(card.amount or 0, card.currency)
    timestamp = now()
    db.execute(
        """
        UPDATE cards
        SET amount = ?, currency = ?, streamer_amount = ?, description = ?,
            merge_count = merge_count + ?, last_merged_at = ?, last_merge_note = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            amount,
            currency,
            streamer_amount,
            description,
            card.merge_count,
            timestamp,
            f"+{added_money} от {card.donor_name}",
            timestamp,
            target.id,
        ),
    )

    # Вторая карточка уходит в историю со ссылкой на основную — ничего не теряется
    archive_card(db, card.id, "merged")
    db.execute("UPDATE cards SET merged_into_id = ? WHERE id = ?", (target.id, card.id))
    return get_card(db, target.id)


def unmerge_card(db: sqlite3.Connection, card: Card) -> None:
    """
    Отменяет объединение: вычитает сумму card из основной карточки и убирает
    дописанный текст. Саму card на доску возвращает тот, кто вызвал (restore в истории).

    Если основную карточку успели отредактировать и дописанного текста в конце уже нет,
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
        # Основная карточка уже в валюте стримера (см. merge_card)
        amount = (target.amount or 0) - (card.streamer_amount or 0)
    streamer_amount = (target.streamer_amount or 0) - (card.streamer_amount or 0)

    description = target.description
    added_text = card_text(card)
    added_part = f"\n{MERGE_SEPARATOR}\n{added_text}"
    if added_text == "":
        # Второй донат был без текста — к описанию ничего не дописывали
        pass
    elif description == added_text:
        # У основной карточки текста не было, описание целиком от второго доната
        description = ""
    elif description.endswith(added_part):
        description = description.removesuffix(added_part)
        # Если остался только заголовок карточки, значит описание было пустым
        if description == target.title:
            description = ""

    db.execute(
        """
        UPDATE cards
        SET amount = ?, streamer_amount = ?, description = ?, merge_count = merge_count - ?,
            last_merged_at = NULL, last_merge_note = NULL, updated_at = ?
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


def format_money(amount: float, currency: str | None) -> str:
    """1500 и RUB → «1 500 ₽». Как formatMoney на фронте, только попроще."""
    number = f"{amount:,.0f}" if amount == int(amount) else f"{amount:,.2f}"
    number = number.replace(",", " ")
    sign = CURRENCY_SIGNS.get(currency or STREAMER_CURRENCY, currency)
    return f"{number} {sign}"
