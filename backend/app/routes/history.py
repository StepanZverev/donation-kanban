"""
Эндпоинты истории: карточки, которые убрали с доски.
"""


from fastapi import APIRouter, Depends, HTTPException

from ..board import get_board_id, get_card, get_column, get_column_id_by_kind, return_to_board
from ..db import Connection, get_db
from ..merging import unmerge_card
from ..realtime import notify_board_changed
from ..schemas import ArchiveReason, Card, CardRestore

router = APIRouter(prefix="/api/boards/{board_id}/history", tags=["История"])


def get_archived_card(db: Connection, board_id: int, card_id: int) -> Card:
    card = get_card(db, board_id, card_id)
    if card.archived_at is None:
        raise HTTPException(status_code=404, detail="Карточки нет в истории")
    return card


@router.get("")
def list_history(
    reason: ArchiveReason | None = None,
    q: str = "",
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> list[Card]:
    """
    История, сначала самые недавние.

    reason — только карточки с этой пометкой (done, deleted, merged, rejected), без него — все.
    q — поиск: остаются карточки, у которых ник, заголовок или текст содержат эти буквы
    (большие и маленькие не различаем).
    """
    sql = "SELECT * FROM cards WHERE board_id = %s AND archived_at IS NOT NULL"
    params: list[str | int] = [board_id]
    if reason is not None:
        sql += " AND archive_reason = %s"
        params.append(reason)
    sql += " ORDER BY archived_at DESC, id DESC"
    cards = [Card(**row) for row in db.execute(sql, params).fetchall()]

    # Поиск делаем в Python, без учёта регистра: «Вася» и «вася» — одно и то же.
    # Так же ищут подсказки ников (donors.py) и объединение донатов (merging.py).
    query = q.strip().casefold()
    if query:
        cards = [card for card in cards if query in searchable_text(card)]
    return cards


def searchable_text(card: Card) -> str:
    """
    Всё, по чему ищем: ник, заголовок, текст карточки и причина отказа —
    одной строкой в нижнем регистре.
    """
    return " ".join([card.donor_name or "", card.title, card.description, card.archive_note or ""]).casefold()


@router.post("/{card_id}/restore")
def restore_card(
    card_id: int,
    data: CardRestore | None = None,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> Card:
    """
    Переоткрывает карточку: возвращает её на доску в указанную колонку или в «Очередь».
    У объединённой карточки сначала вычитаем её сумму и текст из основной.
    """
    card = get_archived_card(db, board_id, card_id)
    if card.archive_reason == "merged" and card.merged_into_id is not None:
        unmerge_card(db, card)
    if data is None or data.column_id is None:
        column_id = get_column_id_by_kind(db, board_id, "incoming")
    else:
        column_id = get_column(db, board_id, data.column_id).id

    return_to_board(db, card_id, column_id)
    notify_board_changed(db, board_id)
    return get_card(db, board_id, card_id)


@router.delete("/{card_id}", status_code=204)
def delete_forever(
    card_id: int,
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> None:
    """Удаляет карточку из истории окончательно, без возможности вернуть."""
    get_archived_card(db, board_id, card_id)
    db.execute("DELETE FROM cards WHERE id = %s", (card_id,))
    notify_board_changed(db, board_id)
