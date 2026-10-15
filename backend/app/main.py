"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .board import find_or_create_user_board
from .db import init_db, open_db
from .donationalerts.listener import donation_listeners
from .realtime import board_updates
from .routes import auth, cards, columns, dev, donors, history, me, settings, stream
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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/api/ws")
async def board_updates_socket(websocket: WebSocket) -> None:
    """
    Фронт подключается сюда и ждёт сообщений {"type": "board_changed"} о своей доске.
    Сам фронт ничего не присылает, цикл нужен, чтобы держать соединение открытым.

    Кто подключился, узнаём по той же cookie сессии, что и в обычных запросах.
    Без сессии соединение закрываем: гостя создаёт обычный запрос (/api/me),
    а не WebSocket.
    """
    with open_db() as db:
        user = find_session_user(db, websocket.cookies.get(SESSION_COOKIE))
        board_id = find_or_create_user_board(db, user["id"]) if user else None
    if board_id is None:
        # 1008 — стандартный код «нарушены правила»: здесь — нет сессии
        await websocket.close(code=1008)
        return

    await board_updates.connect(websocket, board_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        board_updates.disconnect(websocket, board_id)
