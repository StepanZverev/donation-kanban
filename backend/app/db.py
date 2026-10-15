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


# Доски. У каждого пользователя своя доска, в ней свои колонки, карточки и настройки
# (поле board_id в таблицах ниже говорит, какой доске принадлежит строка).
#
# Колонки доски. Их три вида (поле kind):
#   incoming — «Очередь», куда падают новые донаты (всегда одна, крайняя левая);
#   work     — промежуточные колонки, например «В работе» (их может быть несколько);
#   done     — «Выполнено» (всегда одна, крайняя правая).
#
# Карточки: и те, что на доске, и история.
# Если archived_at пустой (NULL) — карточка на доске, в колонке column_id.
# Если заполнен — карточка в истории.
SCHEMA = """
CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER REFERENCES users (id),       -- чья доска; пусто — старая доска, хозяина ещё нет
    created_at TEXT    NOT NULL
);

-- Настройки доски «ключ — значение»: уровни, автообъединение, приём заказов и т. п.
CREATE TABLE IF NOT EXISTS board_settings (
    board_id INTEGER NOT NULL REFERENCES boards (id),
    key      TEXT    NOT NULL,
    value    TEXT    NOT NULL,
    PRIMARY KEY (board_id, key)
);

CREATE TABLE IF NOT EXISTS board_columns (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER REFERENCES boards (id),
    title    TEXT    NOT NULL,
    kind     TEXT    NOT NULL,              -- incoming | work | done
    position INTEGER NOT NULL DEFAULT 0     -- порядок слева направо
);

CREATE TABLE IF NOT EXISTS cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id        INTEGER REFERENCES boards (id),
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
    archive_reason  TEXT,                               -- done | deleted | merged | rejected
    archive_note    TEXT,                               -- пояснение к пометке, например причина отказа
    merge_count     INTEGER NOT NULL DEFAULT 1,         -- сколько донатов слито в карточку (1 — не объединена)
    merged_into_id  INTEGER                             -- в какую карточку слили эту (если reason = merged)
);

-- Пользователи. Сначала каждый — гость: строка в users есть,
-- а способов входа (user_logins) нет. Подключил DonationAlerts — появился способ входа.
CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT,                                  -- имя из DonationAlerts; у гостя пусто
    avatar_url   TEXT,
    created_at   TEXT    NOT NULL,
    last_seen_at TEXT    NOT NULL                       -- когда последний раз открывал сайт
);

-- Чем человек входит: donationalerts (позже можно добавить twitch и другие).
-- Один аккаунт DonationAlerts принадлежит только одному пользователю.
CREATE TABLE IF NOT EXISTS user_logins (
    provider         TEXT    NOT NULL,                  -- donationalerts
    provider_user_id TEXT    NOT NULL,                  -- id пользователя в этом сервисе
    user_id          INTEGER NOT NULL REFERENCES users (id),
    created_at       TEXT    NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
);

-- Сессии: по ним бэкенд узнаёт, кто пришёл. Браузер хранит токен в cookie,
-- а мы — только его хэш, чтобы утечка базы не позволила войти чужим токеном.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
);

-- Подключения DonationAlerts: у каждого стримера свои токены.
-- Донаты из подключения падают на доску этого пользователя.
CREATE TABLE IF NOT EXISTS da_connections (
    user_id          INTEGER PRIMARY KEY REFERENCES users (id),
    access_token     TEXT    NOT NULL,
    refresh_token    TEXT,
    last_donation_id INTEGER NOT NULL DEFAULT 0,       -- самый новый донат, который уже видели
    created_at       TEXT    NOT NULL
);

-- Простое хранилище «ключ — значение» для служебных данных всего сервера.
-- Настройки конкретной доски — в board_settings.
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
    Готовит базу при старте сервера: переделывает старую базу под новую схему
    и создаёт недостающие таблицы. Доски с колонками создаются позже,
    когда пользователь впервые откроет сайт (см. boards.py).
    """
    with open_db() as db:
        migrate_from_fixed_statuses(db)
        db.executescript(SCHEMA)
        move_to_boards(db)
        move_da_tokens_to_connections(db)
        rename_pile_to_queue(db)
        add_new_card_fields(db)
        rename_filtered_to_rejected(db)
        join_manual_card_texts(db)


def rename_pile_to_queue(db: sqlite3.Connection) -> None:
    """
    Первая колонка раньше называлась «Куча», теперь «Очередь».
    Переименовываем её в старых базах, но только если название ещё старое.
    """
    db.execute("UPDATE board_columns SET title = 'Очередь' WHERE kind = 'incoming' AND title = 'Куча'")


def add_new_card_fields(db: sqlite3.Connection) -> None:
    """
    Поля карточки, которые появились позже остальных (объединение, пояснение к пометке).
    В старой базе их нет — добавляем. В новой они уже созданы через SCHEMA.
    """
    card_fields = [row["name"] for row in db.execute("PRAGMA table_info(cards)")]
    new_fields = {
        "merge_count": "INTEGER NOT NULL DEFAULT 1",
        "merged_into_id": "INTEGER",
        "archive_note": "TEXT",
    }
    for name, field_type in new_fields.items():
        if name not in card_fields:
            db.execute(f"ALTER TABLE cards ADD COLUMN {name} {field_type}")


def rename_filtered_to_rejected(db: sqlite3.Connection) -> None:
    """
    Недолго у отсеянных донатов была своя пометка «filtered», а причина хранилась
    служебным словом (closed, below_min, anonymous). Теперь они «Отклонено» с причиной
    по-русски. Переделываем такие карточки, если они остались в базе.
    """
    old_notes = {
        "closed": "Приём был закрыт",
        "below_min": "Меньше минимальной суммы",
        "anonymous": "Анонимный донат",
    }
    for old_note, new_note in old_notes.items():
        db.execute(
            "UPDATE cards SET archive_reason = 'rejected', archive_note = ?"
            " WHERE archive_reason = 'filtered' AND archive_note = ?",
            (new_note, old_note),
        )
    db.execute("UPDATE cards SET archive_reason = 'rejected' WHERE archive_reason = 'filtered'")


def join_manual_card_texts(db: sqlite3.Connection) -> None:
    """
    Раньше у ручной карточки были отдельные «Заголовок» и «Описание». Теперь у неё,
    как у доната, один текст: короткий лежит в заголовке, длинный — целиком в описании,
    а в заголовке его начало (см. split_message).

    Старые карточки узнаём по тому, что описание не начинается с заголовка.
    Склеиваем «заголовок + описание» в один текст и раскладываем заново.
    """
    # Импорт внутри функции: donations.py сам импортирует этот файл
    from .donations import split_message

    rows = db.execute(
        "SELECT id, title, description FROM cards WHERE source = 'manual' AND description != ''"
    ).fetchall()
    for row in rows:
        if row["description"].startswith(row["title"].removesuffix("…")):
            continue
        title, description = split_message(f"{row['title']}\n{row['description']}")
        db.execute(
            "UPDATE cards SET title = ?, description = ? WHERE id = ?", (title, description, row["id"])
        )


def create_default_columns(db: sqlite3.Connection, board_id: int | None) -> None:
    """Создаёт доске колонки «Очередь», «В работе» и «Выполнено»."""
    for position, (title, kind) in enumerate(DEFAULT_COLUMNS):
        db.execute(
            "INSERT INTO board_columns (board_id, title, kind, position) VALUES (?, ?, ?, ?)",
            (board_id, title, kind, position),
        )


# Настройки, которые раньше лежали в общей таблице settings, а теперь у каждой доски свои
BOARD_SETTING_KEYS = [
    "priority_levels",  # routes/settings.py
    "auto_merge",  # merging.py
    "intake_open",  # intake.py
    "min_amount",
    "ignore_anonymous",
    "stream_started_at",  # routes/stream.py
]


def move_to_boards(db: sqlite3.Connection) -> None:
    """
    Раньше доска была одна на весь сервер. Теперь у каждого пользователя своя,
    и у колонок и карточек есть поле board_id.

    Для старой базы: добавляем поле board_id и собираем всё, что уже есть
    (колонки, карточки, настройки), в одну доску. Её хозяином становится тот,
    кто подключил DonationAlerts, а если такого нет — тот, кто заходил на сайт последним
    (скорее всего, это сам стример со своего основного браузера).
    Если пользователей ещё нет, доска остаётся без хозяина: её заберёт себе
    первый, кто откроет сайт (см. boards.get_board_id).
    """
    for table in ["board_columns", "cards"]:
        fields = [row["name"] for row in db.execute(f"PRAGMA table_info({table})")]
        if "board_id" not in fields:
            db.execute(f"ALTER TABLE {table} ADD COLUMN board_id INTEGER REFERENCES boards (id)")
    # Индексы ускоряют поиск строк одной доски. Создаём их здесь, а не в SCHEMA:
    # в старой базе поле board_id появляется только строчкой выше.
    db.execute("CREATE INDEX IF NOT EXISTS board_columns_board ON board_columns (board_id)")
    db.execute("CREATE INDEX IF NOT EXISTS cards_board ON cards (board_id)")

    has_old_columns = db.execute("SELECT 1 FROM board_columns WHERE board_id IS NULL LIMIT 1").fetchone()
    if has_old_columns is None:
        return

    owner = db.execute(
        """
        SELECT users.id FROM users
        LEFT JOIN user_logins ON user_logins.user_id = users.id AND user_logins.provider = 'donationalerts'
        ORDER BY user_logins.user_id IS NULL, users.last_seen_at DESC
        LIMIT 1
        """
    ).fetchone()
    cursor = db.execute(
        "INSERT INTO boards (owner_id, created_at) VALUES (?, ?)",
        (owner["id"] if owner else None, now()),
    )
    board_id = cursor.lastrowid
    db.execute("UPDATE board_columns SET board_id = ? WHERE board_id IS NULL", (board_id,))
    db.execute("UPDATE cards SET board_id = ? WHERE board_id IS NULL", (board_id,))
    for key in BOARD_SETTING_KEYS:
        value = get_setting(db, key)
        if value is not None:
            set_board_setting(db, board_id, key, value)
            delete_setting(db, key)


def move_da_tokens_to_connections(db: sqlite3.Connection) -> None:
    """
    Раньше подключение DonationAlerts было одно на весь сервер и лежало в settings.
    Переносим его в da_connections — тому пользователю, кто его подключал.
    Если он неизвестен (подключали ещё до появления пользователей), отдаём хозяину
    первой доски: туда донаты и падали. Если и такого нет, подключение просто
    забываем — DA нужно будет подключить заново.
    """
    access_token = get_setting(db, "da_access_token")
    if access_token is not None:
        owner_id = get_setting(db, "da_owner_user_id")
        if owner_id is None:
            row = db.execute("SELECT owner_id FROM boards WHERE owner_id IS NOT NULL ORDER BY id LIMIT 1").fetchone()
            owner_id = row["owner_id"] if row else None
        if owner_id is not None:
            db.execute(
                """
                INSERT OR IGNORE INTO da_connections (user_id, access_token, refresh_token, last_donation_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    int(owner_id),
                    access_token,
                    get_setting(db, "da_refresh_token"),
                    int(get_setting(db, "da_last_donation_id") or 0),
                    now(),
                ),
            )
    for key in ["da_access_token", "da_refresh_token", "da_last_donation_id", "da_owner_user_id"]:
        delete_setting(db, key)


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
    create_default_columns(db, None)

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


def get_board_setting(db: sqlite3.Connection, board_id: int, key: str) -> str | None:
    row = db.execute(
        "SELECT value FROM board_settings WHERE board_id = ? AND key = ?", (board_id, key)
    ).fetchone()
    return row["value"] if row else None


def set_board_setting(db: sqlite3.Connection, board_id: int, key: str, value: str) -> None:
    db.execute(
        "INSERT OR REPLACE INTO board_settings (board_id, key, value) VALUES (?, ?, ?)",
        (board_id, key, value),
    )
