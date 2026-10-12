"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .db import init_db
from .realtime import board_updates
from .routes import cards, dev, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код до yield выполняется один раз при старте сервера.
    init_db()
    yield


app = FastAPI(title="Donation Kanban", lifespan=lifespan)

# Подключаем группы эндпоинтов из папки routes/
app.include_router(cards.router)
app.include_router(history.router)
app.include_router(dev.router)


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
