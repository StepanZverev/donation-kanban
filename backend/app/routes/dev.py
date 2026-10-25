"""
Эндпоинты для разработки: позволяют проверить доску без настоящих донатов.
Работают только при локальном запуске (см. DEV_TOOLS_ENABLED в config.py),
на настоящем сервере отвечают 404.
"""

import random
import time

from fastapi import APIRouter, Depends, HTTPException

from .. import config
from ..board import get_board_id
from ..db import Connection, get_db
from ..defaults import STREAMER_CURRENCY
from ..donations import Donation, add_donation_card
from ..realtime import notify_board_changed


def require_dev_tools() -> None:
    """Пропускает запрос дальше только при локальном запуске."""
    if not config.DEV_TOOLS_ENABLED:
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(
    prefix="/api/boards/{board_id}/dev",
    tags=["Для разработки"],
    dependencies=[Depends(require_dev_tools)],
)

# Пустая строка — анонимный донат
FAKE_NAMES = ["Вася", "Катя_стрим", "Dimon2007", "", "MegaFan", "ЛёхаПро"]
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
def create_fake_donation(
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> dict[str, str]:
    """Создаёт карточку из случайного выдуманного доната на доске того, кто нажал кнопку."""
    amount = random.choice([50, 100, 150, 300, 500, 1000])
    donation = Donation(
        # Отрицательный id, чтобы никогда не совпасть с id настоящего доната
        id=-time.time_ns(),
        username=random.choice(FAKE_NAMES),
        message=random.choice(FAKE_MESSAGES),
        amount=amount,
        currency=STREAMER_CURRENCY,
        streamer_amount=amount,
    )
    add_donation_card(db, board_id, donation)
    notify_board_changed(db, board_id)
    return {"status": "ok"}
