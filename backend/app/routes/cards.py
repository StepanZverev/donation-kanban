"""
Эндпоинты карточек на доске.

Каждая функция ниже — это один адрес API. Декоратор над функцией
(@router.get, @router.post …) говорит, какой HTTP-метод и путь она обслуживает.
"""

import sqlite3

from fastapi import APIRouter, Depends

from ..board import get_card, get_column_ids, save_column_order
from ..db import get_db, now
from ..schemas import Card, CardCreate, CardMove, CardUpdate

router = APIRouter(prefix="/api/cards", tags=["Карточки"])


@router.get("")
def list_cards(db: sqlite3.Connection = Depends(get_db)) -> list[Card]:
    """Все карточки на доске (без истории), отсортированные по колонкам и порядку."""
    rows = db.execute(
        "SELECT * FROM cards WHERE archived_at IS NULL ORDER BY status, position, id"
    ).fetchall()
    return [Card(**row) for row in rows]


@router.post("", status_code=201)
def create_card(data: CardCreate, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """Создаёт карточку вручную. Новая карточка встаёт в конец своей колонки."""
    position = len(get_column_ids(db, data.status))
    timestamp = now()
    cursor = db.execute(
        """
        INSERT INTO cards (title, description, status, position, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'manual', ?, ?)
        """,
        (data.title, data.description, data.status, position, timestamp, timestamp),
    )
    return get_card(db, cursor.lastrowid)


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
    return get_card(db, card_id)


@router.post("/{card_id}/move")
def move_card(card_id: int, data: CardMove, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Перемещает карточку в любую колонку и на любое место — то, что происходит
    при drag-and-drop. Ограничений на направление нет.
    """
    card = get_card(db, card_id)

    # 1. Достаём карточку из старой колонки и перенумеровываем оставшиеся.
    old_column = get_column_ids(db, card.status)
    old_column.remove(card_id)
    save_column_order(db, card.status, old_column)

    # 2. Вставляем её в новую колонку на нужное место.
    #    Если позиция больше длины колонки, карточка просто встанет в конец.
    new_column = get_column_ids(db, data.status)
    if card_id in new_column:
        new_column.remove(card_id)
    new_column.insert(data.position, card_id)
    save_column_order(db, data.status, new_column)

    db.execute("UPDATE cards SET updated_at = ? WHERE id = ?", (now(), card_id))
    return get_card(db, card_id)


@router.delete("/{card_id}")
def remove_card(card_id: int, db: sqlite3.Connection = Depends(get_db)) -> Card:
    """
    Убирает карточку с доски в историю (насовсем она не удаляется).
    Если карточка была в «Выполнено», в истории пометим её как выполненную,
    иначе — как удалённую.
    """
    card = get_card(db, card_id)
    reason = "done" if card.status == "done" else "deleted"
    timestamp = now()
    db.execute(
        "UPDATE cards SET archived_at = ?, archive_reason = ?, updated_at = ? WHERE id = ?",
        (timestamp, reason, timestamp, card_id),
    )

    # Сдвигаем вверх карточки, которые были под удалённой.
    column = get_column_ids(db, card.status)
    save_column_order(db, card.status, column)

    return get_card(db, card_id)
