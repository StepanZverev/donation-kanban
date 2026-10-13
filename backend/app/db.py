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


# Колонки доски. Их три вида (поле kind):
#   incoming — «Очередь», куда падают новые донаты (всегда одна, крайняя левая);
#   work     — промежуточные колонки, например «В работе» (их может быть несколько);
#   done     — «Выполнено» (всегда одна, крайняя правая).
#
# Карточки: и те, что на доске, и история.
# Если archived_at пустой (NULL) — карточка на доске, в колонке column_id.
# Если заполнен — карточка в истории.
SCHEMA = """
CREATE TABLE IF NOT EXISTS board_columns (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    title    TEXT    NOT NULL,
    kind     TEXT    NOT NULL,              -- incoming | work | done
    position INTEGER NOT NULL DEFAULT 0     -- порядок слева направо
);

CREATE TABLE IF NOT EXISTS cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    column_id       INTEGER REFERENCES board_columns (id),
    source          TEXT    NOT NULL DEFAULT 'manual',  -- manual | donationalerts
    donation_id     INTEGER UNIQUE,                     -- id доната в DonationAlerts, защищает от дублей
    donor_name      TEXT,
    amount          REAL,                               -- сумма в валюте донатера
    currency        TEXT,
    streamer_amount REAL,                               -- та же сумма в валюте стримера, по ней сортируем
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    moved_at        TEXT    NOT NULL,                   -- когда карточка попала в текущую колонку
    archived_at     TEXT,                               -- когда убрали с доски в историю
    archive_reason  TEXT,                               -- done | deleted | merged
    merge_count     INTEGER NOT NULL DEFAULT 1,         -- сколько донатов слито в карточку (значок «×2»)
    merged_into_id  INTEGER,                            -- в какую карточку слили эту (если reason = merged)
    last_merged_at  TEXT,                               -- когда в карточку последний раз что-то слили
    last_merge_note TEXT                                -- что слили, например «+300 ₽ от Васи»
);

-- Простое хранилище «ключ — значение» для служебных данных,
-- например токенов DonationAlerts.
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

# Колонки, с которыми доска создаётся впервые.
DEFAULT_COLUMNS = [
    ("Очередь", "incoming"),
    ("В работе", "work"),
    ("Выполнено", "done"),
]


def now() -> str:
    """
    Текущее время в UTC строкой, например '2026-10-12T11:52:48.123+00:00'.
    Миллисекунды нужны, чтобы различать действия, сделанные в одну секунду
    (например, две карточки, отправленные в «Выполнено» подряд).
    """
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


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
    """
    Готовит базу при старте сервера: переделывает старую базу под новую схему,
    создаёт недостающие таблицы и колонки доски по умолчанию.
    """
    with open_db() as db:
        migrate_from_fixed_statuses(db)
        db.executescript(SCHEMA)
        create_default_columns(db)
        rename_pile_to_queue(db)
        add_merge_fields(db)


def rename_pile_to_queue(db: sqlite3.Connection) -> None:
    """
    Первая колонка раньше называлась «Куча», теперь «Очередь».
    Переименовываем её в старых базах, но только если название ещё старое.
    """
    db.execute("UPDATE board_columns SET title = 'Очередь' WHERE kind = 'incoming' AND title = 'Куча'")


def add_merge_fields(db: sqlite3.Connection) -> None:
    """
    Поля для объединения карточек появились позже остальных.
    В старой базе их нет — добавляем. В новой они уже созданы через SCHEMA.
    """
    card_fields = [row["name"] for row in db.execute("PRAGMA table_info(cards)")]
    new_fields = {
        "merge_count": "INTEGER NOT NULL DEFAULT 1",
        "merged_into_id": "INTEGER",
        "last_merged_at": "TEXT",
        "last_merge_note": "TEXT",
    }
    for name, field_type in new_fields.items():
        if name not in card_fields:
            db.execute(f"ALTER TABLE cards ADD COLUMN {name} {field_type}")


def create_default_columns(db: sqlite3.Connection) -> None:
    """Если колонок ещё нет (новая база), создаёт «Очередь», «В работе» и «Выполнено»."""
    if db.execute("SELECT COUNT(*) FROM board_columns").fetchone()[0] > 0:
        return
    for position, (title, kind) in enumerate(DEFAULT_COLUMNS):
        db.execute(
            "INSERT INTO board_columns (title, kind, position) VALUES (?, ?, ?)",
            (title, kind, position),
        )


def migrate_from_fixed_statuses(db: sqlite3.Connection) -> None:
    """
    Раньше колонки были зашиты в код: у карточки было поле status
    (queue / in_progress / done) и position — место в колонке.
    Теперь колонки лежат в таблице board_columns, а карточка ссылается на неё
    через column_id. Порядок в колонке считается по сумме, position не нужен.

    Функция переделывает старую базу один раз. Для новой базы ничего не делает.
    """
    card_fields = [row["name"] for row in db.execute("PRAGMA table_info(cards)")]
    if "status" not in card_fields:
        return

    # 1. Создаём таблицу колонок с колонками по умолчанию.
    db.executescript(SCHEMA)
    create_default_columns(db)

    # 2. Добавляем карточкам новые поля.
    db.execute("ALTER TABLE cards ADD COLUMN column_id INTEGER REFERENCES board_columns (id)")
    db.execute("ALTER TABLE cards ADD COLUMN streamer_amount REAL")
    db.execute("ALTER TABLE cards ADD COLUMN moved_at TEXT NOT NULL DEFAULT ''")

    # 3. Раскладываем карточки по колонкам: старый статус → вид колонки.
    old_status_to_kind = {"queue": "incoming", "in_progress": "work", "done": "done"}
    for status, kind in old_status_to_kind.items():
        db.execute(
            """
            UPDATE cards
            SET column_id = (SELECT id FROM board_columns WHERE kind = ? ORDER BY position LIMIT 1)
            WHERE status = ?
            """,
            (kind, status),
        )

    # Валюту стримера раньше не знали, поэтому берём сумму как есть.
    db.execute("UPDATE cards SET streamer_amount = amount, moved_at = updated_at")

    # 4. Убираем старые поля, чтобы они не путали.
    db.execute("ALTER TABLE cards DROP COLUMN status")
    db.execute("ALTER TABLE cards DROP COLUMN position")


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
