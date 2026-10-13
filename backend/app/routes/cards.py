"""
Эндпоинты карточек на доске.

Каждая функция ниже — это один адрес API. Декоратор над функцией
(@router.get, @router.post …) говорит, какой HTTP-метод и путь она обслуживает.
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import (
    archive_card,
    get_card,
    get_column,
    get_column_id_by_kind,
    get_columns,
    sort_column_cards,
)
from ..db import get_db, now
from ..merging import merge_card
from ..realtime import notify_board_changed
from ..schemas import Card, CardArchive, CardCreate, CardMove, CardUpdate

router = APIRouter(prefix="/api/cards", tags=["Карточки"])


@router.get("")
def list_cards(db: sqlite3.Connection = Depends(get_db)) -> list[Card]:
    """
    Все карточки на доске (без истории): колонка за колонкой слева направо,
    внутри колонки — в том порядке, в каком их показывать сверху вниз.
    """
    rows = db.execute("SELECT * FROM cards WHERE archived_at IS NULL").fetchall()
    cards = [Card(**row) for row in rows]

    result: list[Card] = []
    for column in get_columns(db):
        column_cards = [card for card in cards if card.column_id == column.id]
        result.extend(sort_column_cards(column, column_cards))
    return result


@router.post("", status_code=201)
def create_card(data: CardCreate, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Создаёт карточку вручную. Если колонку не указали — в «Очередь»."""
    if data.column_id is None:
        column_id = get_column_id_by_kind(db, "incoming")
    else:
        column_id = get_column(db, data.column_id).id

    timestamp = now()
    cursor = db.execute(
        """
        INSERT INTO cards (title, description, column_id, source, created_at, updated_at, moved_at)
        VALUES (?, ?, ?, 'manual', ?, ?, ?)
        """,
        (data.title, data.description, column_id, timestamp, timestamp, timestamp),
    )
    notify_board_changed(db)
    return get_card(db, cursor.lastrowid)


@router.post("/clear-done")
def clear_done(db: sqlite3.Connection = Depends(get_db)) -> dict[str, int]:
    """Кнопка «Очистить»: все карточки из «Выполнено» уходят в историю как выполненные."""
    done_column_id = get_column_id_by_kind(db, "done")
    rows = db.execute(
        "SELECT id FROM cards WHERE column_id = ? AND archived_at IS NULL", (done_column_id,)
    ).fetchall()
    for row in rows:
        archive_card(db, row["id"], "done")

    notify_board_changed(db)
    return {"cleared": len(rows)}


@router.patch("/{card_id}")
def update_card(card_id: int, data: CardUpdate, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Редактирует заголовок и/или описание."""
    card = get_card(db, card_id)
    db.execute(
        "UPDATE cards SET title = ?, description = ?, updated_at = ? WHERE id = ?",
        (
            data.title if data.title is not None else card.title,
            data.description if data.description is not None else card.description,
            now(),
            card_id,
        ),
    )
    notify_board_changed(db)
    return get_card(db, card_id)


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
    Убирает карточку в историю с явной пометкой: «выполнено» или «удалено»,
    из какой бы колонки её ни взяли. Это перетаскивание в зоны по краям доски.
    """
    get_card(db, card_id)
    archive_card(db, card_id, data.reason)

    notify_board_changed(db)
    return get_card(db, card_id)


@router.post("/{card_id}/merge")
def merge(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Кнопка «Объединить» на карточке в «Очереди»: сливает её в основную карточку
    того же донатера (правило — в merging.py). Возвращает основную карточку.
    """
    card = get_card(db, card_id)
    if card.archived_at is not None:
        raise HTTPException(status_code=400, detail="Карточка уже в истории")
    target = merge_card(db, card)

    notify_board_changed(db)
    return target


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
