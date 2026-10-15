"""
Превращение доната в карточку.

Пока донаты приходят только из тестового эндпоинта /api/dev/fake-donation,
позже сюда же будут попадать донаты из DonationAlerts.
"""

import sqlite3
from dataclasses import dataclass

from .board import EMPTY_MESSAGE_TITLE, get_card, get_column_id_by_kind
from .db import now
from .intake import filter_reason
from .merging import find_auto_merge_target, is_auto_merge_enabled, merge_cards

# Сколько символов сообщения показываем в заголовке карточки
TITLE_LENGTH = 80


@dataclass
class Donation:
    id: int  # id доната в DonationAlerts
    username: str  # пустая строка — анонимный донат (на экране пишем «Аноним»)
    message: str
    amount: float  # сумма в валюте донатера
    currency: str
    # Та же сумма в валюте стримера. По ней сортируем: 5 USD и 200 RUB иначе не сравнить.
    streamer_amount: float


def add_donation_card(db: sqlite3.Connection, board_id: int, donation: Donation) -> bool:
    """
    Создаёт карточку в «Очереди» доски board_id. Место в колонке определит сумма доната.
    Возвращает False, если карточка для этого доната уже есть (защита от дублей).

    Если донат не проходит настройки приёма (приём закрыт, сумма меньше минимума,
    аноним), карточка сразу создаётся в истории с пометкой «Отклонено» и причиной.
    У такой карточки archived_at = created_at: так видно, что на доске она не была.

    Если в настройках включено автообъединение и у донатера уже есть карточка,
    новая сразу сливается в неё.
    """
    title, description = split_message(donation.message)
    timestamp = now()
    # Причина отказа, если донат отсеян. Колонку «Очередь» отсеянная карточка всё равно
    # запоминает: «Вернуть на доску» положит её туда.
    reject_note = filter_reason(db, board_id, donation.username, donation.streamer_amount)
    archived_at = timestamp if reject_note else None
    archive_reason = "rejected" if reject_note else None

    # INSERT OR IGNORE молча пропускает вставку, если donation_id уже есть в таблице
    cursor = db.execute(
        """
        INSERT OR IGNORE INTO cards (
            board_id, title, description, column_id, source, donation_id, donor_name,
            amount, currency, streamer_amount, created_at, updated_at, moved_at,
            archived_at, archive_reason, archive_note
        )
        VALUES (?, ?, ?, ?, 'donationalerts', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            board_id,
            title,
            description,
            get_column_id_by_kind(db, board_id, "incoming"),
            donation.id,
            donation.username,
            donation.amount,
            donation.currency,
            donation.streamer_amount,
            timestamp,
            timestamp,
            timestamp,
            archived_at,
            archive_reason,
            reject_note,
        ),
    )
    if cursor.rowcount == 0:
        return False

    if reject_note is None and is_auto_merge_enabled(db, board_id):
        card = get_card(db, board_id, cursor.lastrowid)
        target = find_auto_merge_target(db, board_id, card)
        if target is not None:
            merge_cards(db, board_id, target, [card.id])
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
