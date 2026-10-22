"""
Эндпоинты колонок доски.

«Очередь» и «Выполнено» есть всегда и стоят по краям. Настраиваются только
промежуточные колонки (kind = 'work'): их можно переименовать, добавить,
удалить и переставить. Их всегда от 1 до 3.
"""


from fastapi import APIRouter, Depends, HTTPException

from ..board import (
    get_board_id,
    get_column,
    get_column_id_by_kind,
    get_columns,
    get_owned_board_id,
)
from ..db import Connection, get_db, now
from ..defaults import MAX_WORK_COLUMNS
from ..realtime import notify_board_changed
from ..schemas import BoardColumn, ColumnCreate, ColumnOrder, ColumnUpdate

router = APIRouter(prefix="/api/boards/{board_id}/columns", tags=["Колонки"])


@router.get("")
def list_columns(
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> list[BoardColumn]:
    """Все колонки доски слева направо: «Очередь», промежуточные, «Выполнено»."""
    return get_columns(db, board_id)


@router.post("", status_code=201)
def create_column(
    data: ColumnCreate,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_owned_board_id),
) -> BoardColumn:
    """Добавляет промежуточную колонку последней, прямо перед «Выполнено»."""
    work_ids = get_work_column_ids(db, board_id)
    if len(work_ids) >= MAX_WORK_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Промежуточных колонок может быть не больше {MAX_WORK_COLUMNS}")

    column = db.execute(
        "INSERT INTO board_columns (board_id, title, kind, position) VALUES (%s, %s, 'work', 0) RETURNING id",
        (board_id, data.title),
    ).fetchone()
    put_columns_in_order(db, board_id, [*work_ids, column["id"]])

    notify_board_changed(db, board_id)
    return get_column(db, board_id, column["id"])


@router.put("/order")
def reorder_columns(
    data: ColumnOrder,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_owned_board_id),
) -> list[BoardColumn]:
    """Переставляет промежуточные колонки. Прислать нужно все их id, каждый по одному разу."""
    if sorted(data.column_ids) != sorted(get_work_column_ids(db, board_id)):
        raise HTTPException(status_code=400, detail="Нужно прислать все промежуточные колонки ровно по одному разу")

    put_columns_in_order(db, board_id, data.column_ids)

    notify_board_changed(db, board_id)
    return get_columns(db, board_id)


@router.patch("/{column_id}")
def rename_column(
    column_id: int,
    data: ColumnUpdate,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_owned_board_id),
) -> BoardColumn:
    """Переименовывает промежуточную колонку."""
    get_work_column(db, board_id, column_id)
    db.execute("UPDATE board_columns SET title = %s WHERE id = %s", (data.title, column_id))

    notify_board_changed(db, board_id)
    return get_column(db, board_id, column_id)


@router.delete("/{column_id}", status_code=204)
def delete_column(
    column_id: int,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_owned_board_id),
) -> None:
    """
    Удаляет промежуточную колонку. Её карточки не пропадают, а возвращаются в «Очередь».
    Удалить можно и все промежуточные колонки.
    """
    get_work_column(db, board_id, column_id)
    work_ids = get_work_column_ids(db, board_id)

    # Все карточки колонки (и с доски, и из истории) переезжают в «Очередь»,
    # чтобы ни одна не ссылалась на удалённую колонку.
    incoming_id = get_column_id_by_kind(db, board_id, "incoming")
    db.execute(
        "UPDATE cards SET column_id = %s, moved_at = %s WHERE column_id = %s",
        (incoming_id, now(), column_id),
    )
    db.execute("DELETE FROM board_columns WHERE id = %s", (column_id,))
    put_columns_in_order(db, board_id, [id for id in work_ids if id != column_id])

    notify_board_changed(db, board_id)


def get_work_column(db: Connection, board_id: int, column_id: int) -> BoardColumn:
    """Находит колонку и проверяет, что она промежуточная: «Очередь» и «Выполнено» менять нельзя."""
    column = get_column(db, board_id, column_id)
    if column.kind != "work":
        raise HTTPException(status_code=400, detail="«Очередь» и «Выполнено» настраивать нельзя")
    return column


def get_work_column_ids(db: Connection, board_id: int) -> list[int]:
    """id промежуточных колонок слева направо."""
    return [column.id for column in get_columns(db, board_id) if column.kind == "work"]


def put_columns_in_order(db: Connection, board_id: int, work_ids: list[int]) -> None:
    """
    Заново нумерует колонки слева направо: «Очередь» — 0, потом промежуточные
    в порядке work_ids, «Выполнено» — последней.
    """
    ordered_ids = [
        get_column_id_by_kind(db, board_id, "incoming"),
        *work_ids,
        get_column_id_by_kind(db, board_id, "done"),
    ]
    for position, column_id in enumerate(ordered_ids):
        db.execute("UPDATE board_columns SET position = %s WHERE id = %s", (position, column_id))
