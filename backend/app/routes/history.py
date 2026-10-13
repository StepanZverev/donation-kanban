"""
Эндпоинты истории: карточки, которые убрали с доски.
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import get_card, get_column, get_column_id_by_kind, return_to_board
from ..db import get_db
from ..merging import unmerge_card
from ..realtime import notify_board_changed
from ..schemas import Card, CardRestore

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
def restore_card(
    card_id: int,
    data: CardRestore | None = None,
    db: sqlite3.Connection = Depends(get_db),
) -> Card:
    """
    Переоткрывает карточку: возвращает её на доску в указанную колонку или в «Очередь».
    У объединённой карточки сначала вычитаем её сумму и текст из основной.
    """
    card = get_archived_card(db, card_id)
    if card.archive_reason == "merged" and card.merged_into_id is not None:
        unmerge_card(db, card)
    if data is None or data.column_id is None:
        column_id = get_column_id_by_kind(db, "incoming")
    else:
        column_id = get_column(db, data.column_id).id

    return_to_board(db, card_id, column_id)
    notify_board_changed(db)
    return get_card(db, card_id)


@router.delete("/{card_id}", status_code=204)
def delete_forever(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> None:
    """Удаляет карточку из истории окончательно, без возможности вернуть."""
    get_archived_card(db, card_id)
    db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    notify_board_changed(db)
