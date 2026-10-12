"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .routes import cards, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код до yield выполняется один раз при старте сервера.
    init_db()
    yield


app = FastAPI(title="Donation Kanban", lifespan=lifespan)

# Подключаем группы эндпоинтов из папки routes/
app.include_router(cards.router)
app.include_router(history.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
