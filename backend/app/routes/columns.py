"""
Эндпоинты колонок доски.

«Очередь» и «Выполнено» есть всегда и стоят по краям. Настраиваются только
промежуточные колонки (kind = 'work'): их можно переименовать, добавить,
удалить и переставить. Их всегда от 1 до 3.
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import get_column, get_column_id_by_kind, get_columns
from ..db import get_db, now
from ..realtime import notify_board_changed
from ..schemas import BoardColumn, ColumnCreate, ColumnOrder, ColumnUpdate

router = APIRouter(prefix="/api/columns", tags=["Колонки"])

# Сколько может быть промежуточных колонок
MIN_WORK_COLUMNS = 1
MAX_WORK_COLUMNS = 3


@router.get("")
def list_columns(db: sqlite3.Connection = Depends(get_db)) -> list[BoardColumn]:
    """Все колонки доски слева направо: «Очередь», промежуточные, «Выполнено»."""
    return get_columns(db)


@router.post("", status_code=201)
def create_column(data: ColumnCreate, db: sqlite3.Connection = Depends(get_db)) -> BoardColumn:
    """Добавляет промежуточную колонку последней, прямо перед «Выполнено»."""
    work_ids = get_work_column_ids(db)
    if len(work_ids) >= MAX_WORK_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Промежуточных колонок может быть не больше {MAX_WORK_COLUMNS}")

    cursor = db.execute(
        "INSERT INTO board_columns (title, kind, position) VALUES (?, 'work', 0)", (data.title,)
    )
    put_columns_in_order(db, [*work_ids, cursor.lastrowid])

    notify_board_changed(db)
    return get_column(db, cursor.lastrowid)


@router.put("/order")
def reorder_columns(data: ColumnOrder, db: sqlite3.Connection = Depends(get_db)) -> list[BoardColumn]:
    """Переставляет промежуточные колонки. Прислать нужно все их id, каждый по одному разу."""
    if sorted(data.column_ids) != sorted(get_work_column_ids(db)):
        raise HTTPException(status_code=400, detail="Нужно прислать все промежуточные колонки ровно по одному разу")

    put_columns_in_order(db, data.column_ids)

    notify_board_changed(db)
    return get_columns(db)


@router.patch("/{column_id}")
def rename_column(column_id: int, data: ColumnUpdate, db: sqlite3.Connection = Depends(get_db)) -> BoardColumn:
    """Переименовывает промежуточную колонку."""
    get_work_column(db, column_id)
    db.execute("UPDATE board_columns SET title = ? WHERE id = ?", (data.title, column_id))

    notify_board_changed(db)
    return get_column(db, column_id)


@router.delete("/{column_id}", status_code=204)
def delete_column(column_id: int, db: sqlite3.Connection = Depends(get_db)) -> None:
    """
    Удаляет промежуточную колонку. Её карточки не пропадают, а возвращаются в «Очередь».
    Последнюю промежуточную колонку удалить нельзя.
    """
    get_work_column(db, column_id)
    work_ids = get_work_column_ids(db)
    if len(work_ids) <= MIN_WORK_COLUMNS:
        raise HTTPException(status_code=400, detail="Нужна хотя бы одна промежуточная колонка")

    # Все карточки колонки (и с доски, и из истории) переезжают в «Очередь»,
    # чтобы ни одна не ссылалась на удалённую колонку.
    incoming_id = get_column_id_by_kind(db, "incoming")
    db.execute(
        "UPDATE cards SET column_id = ?, moved_at = ? WHERE column_id = ?",
        (incoming_id, now(), column_id),
    )
    db.execute("DELETE FROM board_columns WHERE id = ?", (column_id,))
    put_columns_in_order(db, [id for id in work_ids if id != column_id])

    notify_board_changed(db)


def get_work_column(db: sqlite3.Connection, column_id: int) -> BoardColumn:
    """Находит колонку и проверяет, что она промежуточная: «Очередь» и «Выполнено» менять нельзя."""
    column = get_column(db, column_id)
    if column.kind != "work":
        raise HTTPException(status_code=400, detail="«Очередь» и «Выполнено» настраивать нельзя")
    return column


def get_work_column_ids(db: sqlite3.Connection) -> list[int]:
    """id промежуточных колонок слева направо."""
    return [column.id for column in get_columns(db) if column.kind == "work"]


def put_columns_in_order(db: sqlite3.Connection, work_ids: list[int]) -> None:
    """
    Заново нумерует колонки слева направо: «Очередь» — 0, потом промежуточные
    в порядке work_ids, «Выполнено» — последней.
    """
    ordered_ids = [get_column_id_by_kind(db, "incoming"), *work_ids, get_column_id_by_kind(db, "done")]
    for position, column_id in enumerate(ordered_ids):
        db.execute("UPDATE board_columns SET position = ? WHERE id = ?", (position, column_id))
