"""
Работа с базой данных SQLite.

SQLite — это база данных в одном файле (по умолчанию backend/donations.db).
Отдельный сервер БД не нужен: Python умеет работать с ней из коробки
через встроенный модуль sqlite3.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
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

-- Простое хранилище «ключ — значение» для служебных данных,
-- например токенов DonationAlerts.
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def now() -> str:
    """Текущее время в UTC строкой, например '2026-10-12T11:52:48+00:00'."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    # check_same_thread=False: FastAPI может открыть соединение в одном потоке,
    # а закрыть (commit/close в get_db) — в другом. По умолчанию sqlite3 на это
    # падает с ошибкой. Нам это безопасно: одно соединение обслуживает только
    # один запрос, одновременно из двух потоков им никто не пользуется.
    connection = sqlite3.connect(get_database_path(), check_same_thread=False)
    # Благодаря row_factory строки из базы можно читать как словарь: row["title"]
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def open_db() -> Iterator[sqlite3.Connection]:
    """
    Соединение для кода вне эндпоинтов (например, фоновой задачи):
    with open_db() as db: ... — по выходу изменения сохраняются, соединение закрывается.
    """
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    """Создаёт таблицы, если их ещё нет. Вызывается один раз при старте сервера."""
    with open_db() as db:
        db.executescript(SCHEMA)


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


def get_setting(db: sqlite3.Connection, key: str) -> str | None:
    row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_setting(db: sqlite3.Connection, key: str, value: str) -> None:
    # INSERT OR REPLACE: создаст запись или перезапишет существующую
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))


def delete_setting(db: sqlite3.Connection, key: str) -> None:
    db.execute("DELETE FROM settings WHERE key = ?", (key,))
