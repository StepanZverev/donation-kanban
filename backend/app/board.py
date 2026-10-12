"""
Общие операции с доской, которые нужны и карточкам, и истории.
"""

import sqlite3

from fastapi import HTTPException

from .schemas import Card


def get_card(db: sqlite3.Connection, card_id: int) -> Card:
    """Находит карточку по id или отвечает фронту ошибкой 404 «не найдено»."""
    row = db.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Карточка не найдена")
    return Card(**row)


def get_column_ids(db: sqlite3.Connection, status: str) -> list[int]:
    """id карточек в колонке сверху вниз (только те, что на доске, не в истории)."""
    rows = db.execute(
        "SELECT id FROM cards WHERE status = ? AND archived_at IS NULL ORDER BY position, id",
        (status,),
    ).fetchall()
    return [row["id"] for row in rows]


def save_column_order(db: sqlite3.Connection, status: str, card_ids: list[int]) -> None:
    """
    Записывает карточкам колонки новый порядок: первой position = 0, второй = 1 и т.д.
    Так позиции всегда идут подряд без дыр, как бы карточки ни двигали.
    """
    for position, card_id in enumerate(card_ids):
        db.execute(
            "UPDATE cards SET status = ?, position = ? WHERE id = ?",
            (status, position, card_id),
        )
