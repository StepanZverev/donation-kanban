"""
Сумма за стрим и сброс доски.

Сумма копится с последнего сброса: по всем донатам, что пришли после него,
и на доске, и уже в истории. Кнопки «Очистить» её не трогают — сбрасывает
только «Сбросить доску» (клик по сумме в шапке). Сброс заодно убирает
с доски все карточки в историю: стрим закончился, начинаем с чистого листа.
"""

import sqlite3

from fastapi import APIRouter, Depends

from ..board import archive_card, get_column_id_by_kind
from ..db import get_db, get_setting, now, set_setting
from ..realtime import notify_board_changed
from ..schemas import StreamTotal

router = APIRouter(prefix="/api", tags=["Стрим"])

# Ключ в таблице settings: когда последний раз сбрасывали доску.
# Пока не сбрасывали ни разу, считаем все донаты.
STREAM_STARTED_AT_KEY = "stream_started_at"


@router.get("/stream-total")
def get_stream_total(db: sqlite3.Connection = Depends(get_db)) -> StreamTotal:
    """
    Сумма и число донатов с последнего сброса, а ещё сколько карточек сейчас на доске
    (это число показываем в подтверждении сброса).

    Слитые карточки (merged) не считаем: их сумма уже вошла в карточку, в которую их слили.
    Зато число донатов берём из merge_count: в объединённой карточке их несколько.
    Ручные карточки считаем наравне с донатами.
    """
    started_at = get_setting(db, STREAM_STARTED_AT_KEY) or ""
    row = db.execute(
        """
        SELECT
            COALESCE(SUM(streamer_amount), 0) AS total,
            COALESCE(SUM(merge_count), 0) AS donation_count
        FROM cards
        WHERE created_at > ? AND (archive_reason IS NULL OR archive_reason != 'merged')
        """,
        (started_at,),
    ).fetchone()
    board_card_count = db.execute("SELECT COUNT(*) FROM cards WHERE archived_at IS NULL").fetchone()[0]
    return StreamTotal(
        total=row["total"],
        donation_count=row["donation_count"],
        board_card_count=board_card_count,
    )


@router.post("/board/reset")
def reset_board(db: sqlite3.Connection = Depends(get_db)) -> StreamTotal:
    """
    «Сбросить доску»: сумма за стрим обнуляется, все карточки уходят с доски в историю.
    Из «Выполнено» — как выполненные, из остальных колонок — как удалённые.
    """
    done_column_id = get_column_id_by_kind(db, "done")
    rows = db.execute("SELECT id, column_id FROM cards WHERE archived_at IS NULL").fetchall()
    for row in rows:
        archive_card(db, row["id"], "done" if row["column_id"] == done_column_id else "deleted")

    set_setting(db, STREAM_STARTED_AT_KEY, now())
    notify_board_changed(db)
    return get_stream_total(db)
