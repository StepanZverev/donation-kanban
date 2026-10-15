"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI, WebSocket

from .board import find_or_create_user_board
from .db import init_db, now, open_db
from .donationalerts.listener import donation_listeners
from .realtime import send_updates_until_closed
from .routes import auth, cards, columns, dev, donors, history, me, settings, stream, viewer
from .users import SESSION_COOKIE, find_session_user

# Чтобы в терминале были видны наши сообщения (например, «Новый донат от …»)
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код до yield выполняется один раз при старте сервера, после yield — при остановке.
    init_db()
    donation_listeners.start_all()
    yield
    await donation_listeners.stop_all()


app = FastAPI(title="Donation Kanban", lifespan=lifespan)

# Подключаем группы эндпоинтов из папки routes/
app.include_router(cards.router)
app.include_router(columns.router)
app.include_router(history.router)
app.include_router(dev.router)
app.include_router(auth.router)
app.include_router(me.router)
app.include_router(settings.router)
app.include_router(stream.router)
app.include_router(donors.router)
app.include_router(viewer.router)
app.include_router(viewer.public_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/api/ws")
async def board_updates_socket(websocket: WebSocket) -> None:
    """
    Фронт подключается сюда и ждёт сообщений {"type": "board_changed"} о своей доске.

    Кто подключился, узнаём по той же cookie сессии, что и в обычных запросах.
    Без сессии соединение закрываем: гостя создаёт обычный запрос (/api/me),
    а не WebSocket.
    """
    # Работа с базой может подождать, пока другой запрос допишет свои изменения.
    # Ждём в отдельном потоке: иначе сервер замрёт и тот запрос не сможет закончиться.
    board_id = await anyio.to_thread.run_sync(find_session_board, websocket.cookies.get(SESSION_COOKIE))
    if board_id is None:
        # 1008 — стандартный код «нарушены правила»: здесь — нет сессии
        await websocket.close(code=1008)
        return

    await send_updates_until_closed(websocket, board_id)


def find_session_board(session_token: str | None) -> int | None:
    """Доска того, чья это сессия. None — сессии нет."""
    with open_db() as db:
        user = find_session_user(db, session_token)
        if user is None:
            return None
        # Как в обычных запросах (get_current_user), сначала отмечаем визит. Эта запись
        # заодно ставит нас в очередь за другими запросами: если один из них сейчас
        # создаёт доску, мы дождёмся его и найдём её, а не создадим вторую.
        db.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (now(), user["id"]))
        return find_or_create_user_board(db, user["id"])
