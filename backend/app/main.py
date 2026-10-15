"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .donationalerts.listener import donation_listeners
from .routes import auth, cards, columns, dev, donors, history, me, members, settings, stream, viewer

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
app.include_router(members.router)
app.include_router(members.invites_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
