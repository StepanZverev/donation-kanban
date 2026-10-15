"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .db import init_db
from .donationalerts.listener import donation_listener
from .realtime import board_updates
from .routes import auth, cards, columns, dev, donors, history, me, settings, stream

# Чтобы в терминале были видны наши сообщения (например, «Новый донат от …»)
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код до yield выполняется один раз при старте сервера, после yield — при остановке.
    init_db()
    donation_listener.start()
    yield
    await donation_listener.stop()


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
    Фронт подключается сюда и ждёт сообщений {"type": "board_changed"}.
    Сам фронт ничего не присылает, цикл нужен, чтобы держать соединение открытым.
    """
    await board_updates.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        board_updates.disconnect(websocket)
