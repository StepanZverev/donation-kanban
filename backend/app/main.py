"""
Точка входа бэкенда. Запуск: uvicorn app.main:app --reload
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .cleanup import clean_up_forever
from .db import init_db
from .donationalerts.listener import donation_listeners
from .origin_check import check_origin
from .rate_limit import limit_all_requests
from .token_crypto import encrypt_old_tokens
from .routes import auth, cards, columns, dev, donors, history, me, members, settings, stream, viewer

# Чтобы в терминале были видны наши сообщения (например, «Новый донат от …»)
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код до yield выполняется один раз при старте сервера, после yield — при остановке.
    init_db()
    # Токены DA, сохранённые до появления шифрования, шифруем (см. token_crypto.py)
    encrypt_old_tokens()
    donation_listeners.start_all()
    cleanup_task = asyncio.create_task(clean_up_forever())
    yield
    cleanup_task.cancel()
    await donation_listeners.stop_all()


app = FastAPI(title="Donation Kanban", lifespan=lifespan)

# Каждый запрос сначала проходит проверку: не прислал ли его чужой сайт (см. origin_check.py)
app.middleware("http")(check_origin)
# И не шлёт ли этот адрес слишком много запросов (см. rate_limit.py)
app.middleware("http")(limit_all_requests)

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
