"""
Превращение доната в карточку.

Пока донаты приходят только из тестового эндпоинта /api/dev/fake-donation,
позже сюда же будут попадать донаты из DonationAlerts.
"""

import sqlite3
from dataclasses import dataclass

from .board import get_column_ids
from .db import now

# Сколько символов сообщения показываем в заголовке карточки
TITLE_LENGTH = 80


@dataclass
class Donation:
    id: int  # id доната в DonationAlerts
    username: str
    message: str
    amount: float
    currency: str


def add_donation_card(db: sqlite3.Connection, donation: Donation) -> bool:
    """
    Создаёт карточку в конце колонки «В очереди».
    Возвращает False, если карточка для этого доната уже есть (защита от дублей).
    """
    title, description = split_message(donation.message)
    timestamp = now()

    # INSERT OR IGNORE молча пропускает вставку, если donation_id уже есть в таблице
    cursor = db.execute(
        """
        INSERT OR IGNORE INTO cards (
            title, description, status, position, source,
            donation_id, donor_name, amount, currency, created_at, updated_at
        )
        VALUES (?, ?, 'queue', ?, 'donationalerts', ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            description,
            len(get_column_ids(db, "queue")),
            donation.id,
            donation.username,
            donation.amount,
            donation.currency,
            timestamp,
            timestamp,
        ),
    )
    return cursor.rowcount == 1


def split_message(message: str) -> tuple[str, str]:
    """
    Короткое сообщение целиком становится заголовком.
    Длинное обрезается в заголовке, а полностью кладётся в описание.
    """
    message = message.strip()
    if not message:
        return "Донат без сообщения", ""
    if len(message) <= TITLE_LENGTH:
        return message, ""
    return message[: TITLE_LENGTH - 1].rstrip() + "…", message
