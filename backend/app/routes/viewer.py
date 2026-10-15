"""
Страница для зрителей: доска только для чтения по секретной ссылке.

Стример в настройках включает «ссылку для зрителей» и, если хочет, указывает
ссылку на свою страницу доната. Зритель открывает /v/<токен> без входа и видит
доску; кнопка «+» ведёт на страницу доната, а донат сам станет карточкой.

Здесь две группы адресов:
- /api/settings/viewer — настройки, их меняет хозяин доски;
- /api/public/... — то, что видит зритель. Эти адреса не требуют входа
  и ничего не меняют. Гостя для зрителя тоже не создаём.
"""

import secrets
import sqlite3
from urllib.parse import urlparse

import anyio.to_thread
from fastapi import APIRouter, Depends, HTTPException, WebSocket

from ..board import get_board_cards, get_board_id, get_columns
from ..db import delete_board_setting, get_board_setting, get_db, open_db, set_board_setting
from ..intake import get_intake_settings
from ..realtime import notify_board_changed, send_updates_until_closed
from ..schemas import DonationUrl, PublicBoard, PublicCard, ViewerSettings
from .settings import read_priority_levels

router = APIRouter(prefix="/api/settings/viewer", tags=["Для зрителей"])
public_router = APIRouter(prefix="/api/public", tags=["Для зрителей"])

# Ключи в таблице board_settings
PUBLIC_TOKEN_KEY = "public_token"
DONATION_URL_KEY = "donation_url"

# Ссылку на донат принимаем только на эти сайты: кнопку «+» видят все зрители,
# и в неё нельзя подложить ссылку на что-то опасное
DONATION_SITES = {"donationalerts.com", "www.donationalerts.com"}


def read_viewer_settings(db: sqlite3.Connection, board_id: int) -> ViewerSettings:
    return ViewerSettings(
        public_token=get_board_setting(db, board_id, PUBLIC_TOKEN_KEY),
        donation_url=get_board_setting(db, board_id, DONATION_URL_KEY) or "",
    )


def find_board_by_public_token(db: sqlite3.Connection, token: str) -> int | None:
    """Доска, у которой такая ссылка для зрителей. None — ссылка неверная или выключена."""
    row = db.execute(
        "SELECT board_id FROM board_settings WHERE key = ? AND value = ?", (PUBLIC_TOKEN_KEY, token)
    ).fetchone()
    return row["board_id"] if row else None


def is_allowed_donation_url(url: str) -> bool:
    """Ссылка вида https://www.donationalerts.com/r/имя."""
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in DONATION_SITES


@router.get("")
def get_viewer_settings(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> ViewerSettings:
    return read_viewer_settings(db, board_id)


@router.put("/donation-url")
def save_donation_url(
    data: DonationUrl,
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> ViewerSettings:
    """Сохраняет ссылку на донат. Пустая строка убирает кнопку «+» у зрителей."""
    url = data.url.strip()
    if url and not is_allowed_donation_url(url):
        raise HTTPException(
            status_code=400,
            detail="Нужна ссылка на DonationAlerts, например https://www.donationalerts.com/r/имя",
        )
    set_board_setting(db, board_id, DONATION_URL_KEY, url)
    # Открытые страницы зрителей сразу покажут или спрячут кнопку
    notify_board_changed(db, board_id)
    return read_viewer_settings(db, board_id)


@router.post("/link")
def create_public_link(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> ViewerSettings:
    """
    Включает ссылку для зрителей или делает новую вместо старой.
    Старая ссылка сразу перестаёт работать — это нужно, если её выложили не туда.
    Токен длинный и случайный: угадать или перебрать его нельзя.
    """
    set_board_setting(db, board_id, PUBLIC_TOKEN_KEY, secrets.token_urlsafe(16))
    # Страницы зрителей со старой ссылкой перезагрузятся и увидят, что она больше не работает
    notify_board_changed(db, board_id)
    return read_viewer_settings(db, board_id)


@router.delete("/link")
def delete_public_link(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> ViewerSettings:
    """Выключает ссылку для зрителей."""
    delete_board_setting(db, board_id, PUBLIC_TOKEN_KEY)
    notify_board_changed(db, board_id)
    return read_viewer_settings(db, board_id)


@public_router.get("/boards/{token}")
def get_public_board(token: str, db: sqlite3.Connection = Depends(get_db)) -> PublicBoard:
    """Доска для зрителей. 404 — ссылка неверная или стример её выключил."""
    board_id = find_board_by_public_token(db, token)
    if board_id is None:
        raise HTTPException(status_code=404, detail="Ссылка не работает")

    cards = get_board_cards(db, board_id)
    # Хозяин доски: его имя и подключён ли у него DonationAlerts (есть ли строка в da_connections).
    # Выход из аккаунта на устройстве подключение не трогает: донаты продолжают приходить.
    owner = db.execute(
        """
        SELECT users.name, da_connections.user_id IS NOT NULL AS donations_connected
        FROM boards
        JOIN users ON users.id = boards.owner_id
        LEFT JOIN da_connections ON da_connections.user_id = users.id
        WHERE boards.id = ?
        """,
        (board_id,),
    ).fetchone()
    return PublicBoard(
        streamer_name=owner["name"] if owner else None,
        columns=get_columns(db, board_id),
        # model_dump() превращает карточку в словарь; PublicCard возьмёт из него только свои поля
        cards=[PublicCard(**card.model_dump()) for card in cards],
        priority_levels=read_priority_levels(db, board_id),
        donation_url=get_board_setting(db, board_id, DONATION_URL_KEY) or "",
        intake_open=get_intake_settings(db, board_id).open,
        donations_connected=bool(owner and owner["donations_connected"]),
    )


@public_router.websocket("/boards/{token}/ws")
async def public_board_updates(websocket: WebSocket, token: str) -> None:
    """Живые обновления для зрителей: та же комната доски, что и у стримера."""
    # В отдельном потоке, чтобы сервер не замер, пока база занята (см. main.py)
    board_id = await anyio.to_thread.run_sync(find_board_by_link, token)
    if board_id is None:
        await websocket.close(code=1008)
        return
    await send_updates_until_closed(websocket, board_id)


def find_board_by_link(token: str) -> int | None:
    with open_db() as db:
        return find_board_by_public_token(db, token)
