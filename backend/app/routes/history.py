"""
Эндпоинты истории: карточки, которые убрали с доски.
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import get_card, get_column_ids
from ..db import get_db, now
from ..realtime import notify_board_changed
from ..schemas import Card

router = APIRouter(prefix="/api/history", tags=["История"])


def get_archived_card(db: sqlite3.Connection, card_id: int) -> Card:
    card = get_card(db, card_id)
    if card.archived_at is None:
        raise HTTPException(status_code=404, detail="Карточки нет в истории")
    return card


@router.get("")
def list_history(db: sqlite3.Connection = Depends(get_db)) -> list[Card]:
    """Вся история, сначала самые недавние."""
    rows = db.execute(
        "SELECT * FROM cards WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id DESC"
    ).fetchall()
    return [Card(**row) for row in rows]


@router.post("/{card_id}/restore")
def restore_card(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Переоткрывает карточку: возвращает её на доску в конец колонки «В очереди»."""
    get_archived_card(db, card_id)
    position = len(get_column_ids(db, "queue"))
    db.execute(
        """
        UPDATE cards
        SET archived_at = NULL, archive_reason = NULL, status = 'queue', position = ?, updated_at = ?
        WHERE id = ?
        """,
        (position, now(), card_id),
    )
    notify_board_changed(db)
    return get_card(db, card_id)


@router.delete("/{card_id}", status_code=204)
def delete_forever(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> None:
    """Удаляет карточку из истории окончательно, без возможности вернуть."""
    get_archived_card(db, card_id)
    db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    notify_board_changed(db)
