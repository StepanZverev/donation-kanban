"""
Общие операции с доской, которые нужны и карточкам, и истории.
"""

import sqlite3

from fastapi import HTTPException

from .db import now
from .schemas import BoardColumn, Card


def get_card(db: sqlite3.Connection, card_id: int) -> Card:
    """Находит карточку по id или отвечает фронту ошибкой 404 «не найдено»."""
    row = db.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Карточка не найдена")
    return Card(**row)


def get_columns(db: sqlite3.Connection) -> list[BoardColumn]:
    """Все колонки доски слева направо."""
    rows = db.execute("SELECT * FROM board_columns ORDER BY position, id").fetchall()
    return [BoardColumn(**row) for row in rows]


def get_column(db: sqlite3.Connection, column_id: int) -> BoardColumn:
    """Находит колонку по id или отвечает ошибкой 404."""
    row = db.execute("SELECT * FROM board_columns WHERE id = ?", (column_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Колонка не найдена")
    return BoardColumn(**row)


def get_column_id_by_kind(db: sqlite3.Connection, kind: str) -> int:
    """id колонки нужного вида, например «Кучи» (kind = 'incoming')."""
    row = db.execute(
        "SELECT id FROM board_columns WHERE kind = ? ORDER BY position, id LIMIT 1", (kind,)
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


def archive_card(db: sqlite3.Connection, card_id: int, reason: str) -> None:
    """Убирает карточку с доски в историю. reason: 'done' (выполнена) или 'deleted' (выкинута)."""
    timestamp = now()
    db.execute(
        "UPDATE cards SET archived_at = ?, archive_reason = ?, updated_at = ? WHERE id = ?",
        (timestamp, reason, timestamp, card_id),
    )
