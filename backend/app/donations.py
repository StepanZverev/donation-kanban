"""
Превращение доната в карточку.

Пока донаты приходят только из тестового эндпоинта /api/dev/fake-donation,
позже сюда же будут попадать донаты из DonationAlerts.
"""

import sqlite3
from dataclasses import dataclass

from .board import EMPTY_MESSAGE_TITLE, get_card, get_column_id_by_kind
from .db import now
from .merging import find_merge_target, is_auto_merge_enabled, merge_card

# Сколько символов сообщения показываем в заголовке карточки
TITLE_LENGTH = 80


@dataclass
class Donation:
    id: int  # id доната в DonationAlerts
    username: str
    message: str
    amount: float  # сумма в валюте донатера
    currency: str
    # Та же сумма в валюте стримера. По ней сортируем: 5 USD и 200 RUB иначе не сравнить.
    streamer_amount: float


def add_donation_card(db: sqlite3.Connection, donation: Donation) -> bool:
    """
    Создаёт карточку в «Очереди». Место в колонке определит сумма доната.
    Возвращает False, если карточка для этого доната уже есть (защита от дублей).

    Если в настройках включено автообъединение и у донатера уже есть карточка,
    новая сразу сливается в неё.
    """
    title, description = split_message(donation.message)
    timestamp = now()

    # INSERT OR IGNORE молча пропускает вставку, если donation_id уже есть в таблице
    cursor = db.execute(
        """
        INSERT OR IGNORE INTO cards (
            title, description, column_id, source, donation_id, donor_name,
            amount, currency, streamer_amount, created_at, updated_at, moved_at
        )
        VALUES (?, ?, ?, 'donationalerts', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            description,
            get_column_id_by_kind(db, "incoming"),
            donation.id,
            donation.username,
            donation.amount,
            donation.currency,
            donation.streamer_amount,
            timestamp,
            timestamp,
            timestamp,
        ),
    )
    if cursor.rowcount == 0:
        return False

    if is_auto_merge_enabled(db):
        card = get_card(db, cursor.lastrowid)
        if find_merge_target(db, card) is not None:
            merge_card(db, card)
    return True


def split_message(message: str) -> tuple[str, str]:
    """
    Короткое сообщение целиком становится заголовком.
    Длинное обрезается в заголовке, а полностью кладётся в описание.
    """
    message = message.strip()
    if not message:
        return EMPTY_MESSAGE_TITLE, ""
    if len(message) <= TITLE_LENGTH:
        return message, ""
    return message[: TITLE_LENGTH - 1].rstrip() + "…", message
