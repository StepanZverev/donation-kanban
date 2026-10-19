"""
Перенос данных из старой базы SQLite (файл backend/donations.db) в PostgreSQL.

Нужен один раз: до этапа 7 приложение хранило всё в SQLite. Запуск из папки backend
(PostgreSQL должен быть запущен, см. README):

    python -m app.import_sqlite donations.db

Скрипт переносит пользователей, доски, колонки, карточки, настройки, подключения
DonationAlerts и модераторов. Сессии тоже переносятся, так что заново входить не нужно.
В PostgreSQL перед этим не должно быть пользователей: скрипт ничего не перезаписывает.

Старый файл не меняется — если что-то пойдёт не так, его можно перенести ещё раз.
"""

import sqlite3
import sys
from pathlib import Path

from .db import Connection, init_db, open_db

# Таблицы в том порядке, в каком их можно заливать: сначала те, на которые ссылаются другие
# (пользователи раньше досок, доски раньше колонок, колонки раньше карточек)
TABLES = [
    "users",
    "user_logins",
    "sessions",
    "boards",
    "board_settings",
    "board_columns",
    "cards",
    "da_connections",
    "board_members",
]

# Ссылки на другие таблицы: (таблица, поле) → таблица, на чью строку (по id) ссылается поле.
# SQLite не следил за такими ссылками, а PostgreSQL следит и не пустит строку
# со ссылкой «в никуда». Поэтому такие ссылки чиним до переноса (см. fix_broken_links).
LINKS = {
    ("user_logins", "user_id"): "users",
    ("sessions", "user_id"): "users",
    ("boards", "owner_id"): "users",
    ("board_settings", "board_id"): "boards",
    ("board_columns", "board_id"): "boards",
    ("cards", "board_id"): "boards",
    ("cards", "column_id"): "board_columns",
    ("da_connections", "user_id"): "users",
    ("board_members", "board_id"): "boards",
    ("board_members", "user_id"): "users",
}

# Поля, которые не могут быть пустыми: строку с битой ссылкой в таком поле не переносим
REQUIRED_LINKS = {
    ("user_logins", "user_id"),
    ("sessions", "user_id"),
    ("board_settings", "board_id"),
    ("da_connections", "user_id"),
    ("board_members", "board_id"),
    ("board_members", "user_id"),
}

# Таблицы, у которых id выдаёт сама база (SERIAL). После переноса счётчик id
# нужно передвинуть за самый большой перенесённый id, иначе новые строки получат занятые id
TABLES_WITH_ID = ["users", "boards", "board_columns", "cards"]


def import_sqlite(sqlite_path: Path) -> dict[str, int]:
    """Переносит данные и возвращает, сколько строк перенесено в каждую таблицу."""
    old = sqlite3.connect(sqlite_path)
    old.row_factory = sqlite3.Row
    try:
        rows_by_table = read_old_rows(old)
    finally:
        old.close()
    fix_broken_links(rows_by_table)

    init_db()
    with open_db() as db:
        if db.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None:
            raise SystemExit("В PostgreSQL уже есть пользователи. Перенос делается только в пустую базу.")
        counts = {}
        for table in TABLES:
            counts[table] = insert_rows(db, table, rows_by_table[table])
        for table in TABLES_WITH_ID:
            # setval передвигает счётчик id: следующая новая строка получит id больше всех перенесённых
            db.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM {table}"
            )
    return counts


def read_old_rows(old: sqlite3.Connection) -> dict[str, list[dict]]:
    """Все строки нужных таблиц из старой базы. Каждая строка — словарь «поле → значение»."""
    existing = {row["name"] for row in old.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    card_fields = {row["name"] for row in old.execute("PRAGMA table_info(cards)")}
    if "boards" not in existing or "board_id" not in card_fields:
        raise SystemExit(
            "Старая база слишком старая для переноса. Запусти один раз версию приложения до этапа 7 "
            "(она сама обновит файл), потом повтори перенос."
        )
    rows_by_table = {}
    for table in TABLES:
        # Таблицы модераторов могло ещё не быть — тогда переносить нечего
        rows_by_table[table] = [dict(row) for row in old.execute(f"SELECT * FROM {table}")] if table in existing else []
    return rows_by_table


def fix_broken_links(rows_by_table: dict[str, list[dict]]) -> None:
    """
    Ссылка «в никуда» — например, карточка в колонке, которую давно удалили.
    Если поле может быть пустым, очищаем его; если нет — строку не переносим.
    """
    for (table, field), target in LINKS.items():
        known_ids = {row["id"] for row in rows_by_table[target]}
        kept = []
        for row in rows_by_table[table]:
            value = row.get(field)
            if value is None or value in known_ids:
                kept.append(row)
            elif (table, field) in REQUIRED_LINKS:
                print(f"Пропускаю строку {table} со ссылкой {field}={value}: такой строки в {target} нет")
            else:
                print(f"Очищаю {table}.{field}={value} (id строки {row.get('id')}): такой строки в {target} нет")
                row[field] = None
                kept.append(row)
        rows_by_table[table] = kept


def insert_rows(db: Connection, table: str, rows: list[dict]) -> int:
    """Вставляет строки в таблицу PostgreSQL. Поля, которых в PostgreSQL нет, пропускает."""
    if not rows:
        return 0
    new_fields = {row["column_name"] for row in db.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table,)
    )}
    fields = [field for field in rows[0] if field in new_fields]
    placeholders = ", ".join(["%s"] * len(fields))
    with db.cursor() as cursor:
        cursor.executemany(
            f"INSERT INTO {table} ({', '.join(fields)}) VALUES ({placeholders})",
            [[row[field] for field in fields] for row in rows],
        )
    return len(rows)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Укажи путь к старой базе: python -m app.import_sqlite donations.db")
    sqlite_path = Path(sys.argv[1])
    if not sqlite_path.exists():
        raise SystemExit(f"Файл {sqlite_path} не найден")
    counts = import_sqlite(sqlite_path)
    print("Перенесено:")
    for table, count in counts.items():
        print(f"  {table}: {count}")


if __name__ == "__main__":
    main()
