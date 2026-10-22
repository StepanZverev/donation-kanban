"""
Работа с базой данных PostgreSQL.

PostgreSQL — отдельный сервер базы данных. Локально он запускается в Docker
(docker compose up -d, см. docker-compose.yml в корне проекта), на сервере — так же.
Python говорит с ним через библиотеку psycopg. ORM нет: запросы — обычный SQL.

Адрес базы берётся из переменной окружения DATABASE_URL (см. config.py).

Таблицы описаны не здесь, а в папке backend/migrations: при старте сервера
недостающие миграции применяются сами (см. migrations.py).

Пара отличий от SQLite, которые важно помнить, когда пишешь запрос:
- значения подставляются через %s, а не через ?: "SELECT * FROM cards WHERE id = %s";
- id только что добавленной строки узнаём через RETURNING id (см. create_board);
- знак % в самом тексте запроса нужно писать как %%, иначе psycopg примет его за подстановку.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.rows import dict_row

from . import config
from .defaults import DEFAULT_COLUMNS

# Соединение с базой и строка из неё. Строку можно читать как словарь: row["title"].
Connection = psycopg.Connection[dict[str, Any]]
Row = dict[str, Any]

def now() -> str:
    """
    Текущее время в UTC строкой, например '2026-10-12T11:52:48.123+00:00'.
    Миллисекунды нужны, чтобы различать действия, сделанные в одну секунду
    (например, две карточки, отправленные в «Выполнено» подряд).
    """
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def connect() -> Connection:
    # row_factory=dict_row: строки из базы приходят словарями, и их можно читать как row["title"].
    # lock_timeout: если строка занята другим соединением дольше 10 секунд, запрос падает
    # с ошибкой, а не ждёт вечно (так ошибку в коде видно сразу, а сервер не зависает)
    return psycopg.connect(config.get_database_url(), row_factory=dict_row, options="-c lock_timeout=10s")


@contextmanager
def open_db() -> Iterator[Connection]:
    """
    Соединение для кода вне эндпоинтов (например, фоновой задачи):
    with open_db() as db: ... — по выходу изменения сохраняются, соединение закрывается.
    Если внутри случилась ошибка, изменения отменяются.
    """
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    """Готовит базу при старте сервера: применяет миграции, которых в ней ещё нет."""
    # Импорт внутри функции: migrations.py сам импортирует этот файл
    from .migrations import apply_migrations

    with open_db() as db:
        apply_migrations(db)


def get_db() -> Iterator[Connection]:
    """
    Выдаёт соединение с базой на время одного запроса.

    FastAPI вызывает эту функцию сам, если эндпоинт объявил параметр
    `db: Connection = Depends(get_db)`. После ответа изменения
    сохраняются (commit), а соединение закрывается.
    """
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def create_default_columns(db: Connection, board_id: int | None) -> None:
    """Создаёт доске колонки по умолчанию: «Очередь», «В работе» и «Выполнено» (см. defaults.py)."""
    for position, (title, kind) in enumerate(DEFAULT_COLUMNS):
        db.execute(
            "INSERT INTO board_columns (board_id, title, kind, position) VALUES (%s, %s, %s, %s)",
            (board_id, title, kind, position),
        )


def get_board_setting(db: Connection, board_id: int, key: str) -> str | None:
    row = db.execute(
        "SELECT value FROM board_settings WHERE board_id = %s AND key = %s", (board_id, key)
    ).fetchone()
    return row["value"] if row else None


def set_board_setting(db: Connection, board_id: int, key: str, value: str) -> None:
    # ON CONFLICT ... DO UPDATE: создаст запись, а если такая уже есть — перезапишет значение
    db.execute(
        """
        INSERT INTO board_settings (board_id, key, value) VALUES (%s, %s, %s)
        ON CONFLICT (board_id, key) DO UPDATE SET value = excluded.value
        """,
        (board_id, key, value),
    )


def delete_board_setting(db: Connection, board_id: int, key: str) -> None:
    db.execute("DELETE FROM board_settings WHERE board_id = %s AND key = %s", (board_id, key))
