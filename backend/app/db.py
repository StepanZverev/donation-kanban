"""
Работа с базой данных SQLite.

SQLite — это база данных в одном файле (по умолчанию backend/donations.db).
Отдельный сервер БД не нужен: Python умеет работать с ней из коробки
через встроенный модуль sqlite3.
"""

import os
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

# Путь к файлу базы. Можно переопределить переменной окружения DATABASE_PATH
# (так делают тесты, чтобы не трогать настоящую базу).
DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "donations.db"


def get_database_path() -> str:
    return os.environ.get("DATABASE_PATH", str(DEFAULT_DATABASE_PATH))


# Одна таблица на всё: и карточки на доске, и история.
# Если archived_at пустой (NULL) — карточка на доске.
# Если заполнен — карточка в истории.
SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT    NOT NULL,
    description    TEXT    NOT NULL DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'queue',   -- queue | in_progress | done
    position       INTEGER NOT NULL DEFAULT 0,         -- порядок внутри колонки, с нуля
    source         TEXT    NOT NULL DEFAULT 'manual',  -- manual | donationalerts
    donation_id    INTEGER UNIQUE,                     -- id доната в DonationAlerts, защищает от дублей
    donor_name     TEXT,
    amount         REAL,
    currency       TEXT,
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL,
    archived_at    TEXT,                               -- когда убрали с доски в историю
    archive_reason TEXT                                -- done | deleted
);
"""


def now() -> str:
    """Текущее время в UTC строкой, например '2026-10-12T11:52:48+00:00'."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(get_database_path())
    # Благодаря row_factory строки из базы можно читать как словарь: row["title"]
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    """Создаёт таблицу, если её ещё нет. Вызывается один раз при старте сервера."""
    with connect() as connection:
        connection.executescript(SCHEMA)


def get_db() -> Iterator[sqlite3.Connection]:
    """
    Выдаёт соединение с базой на время одного запроса.

    FastAPI вызывает эту функцию сам, если эндпоинт объявил параметр
    `db: sqlite3.Connection = Depends(get_db)`. После ответа изменения
    сохраняются (commit), а соединение закрывается.
    """
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()
