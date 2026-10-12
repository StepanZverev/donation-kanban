"""
Эндпоинты для разработки: позволяют проверить доску без настоящих донатов.
"""

import random
import sqlite3
import time

from fastapi import APIRouter, Depends

from ..db import get_db
from ..donations import Donation, add_donation_card
from ..realtime import notify_board_changed

router = APIRouter(prefix="/api/dev", tags=["Для разработки"])

FAKE_NAMES = ["Вася", "Катя_стрим", "Dimon2007", "Аноним", "MegaFan", "ЛёхаПро"]
FAKE_MESSAGES = [
    "Спой «Звезду по имени Солнце»!",
    "Сыграй следующую катку на пистолетах",
    "Какая у тебя мышка?",
    "Привет из Казани!",
    "",
    "Расскажи, как ты начал стримить, очень интересно, давно хотел спросить, "
    "смотрю тебя уже второй год и всё никак не решался задонатить",
]


@router.post("/fake-donation", status_code=201)
def create_fake_donation(db: sqlite3.Connection = Depends(get_db)) -> dict[str, str]:
    """Создаёт карточку из случайного выдуманного доната."""
    amount = random.choice([50, 100, 150, 300, 500, 1000])
    donation = Donation(
        # Отрицательный id, чтобы никогда не совпасть с id настоящего доната
        id=-time.time_ns(),
        username=random.choice(FAKE_NAMES),
        message=random.choice(FAKE_MESSAGES),
        amount=amount,
        currency="RUB",
        streamer_amount=amount,
    )
    add_donation_card(db, donation)
    notify_board_changed(db)
    return {"status": "ok"}
