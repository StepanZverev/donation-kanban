"""
Миграции — пошаговые изменения базы данных.

Каждый шаг — файл в папке backend/migrations с номером в начале имени:
001_initial.sql, 002_….sql и так далее. При старте сервера функция apply_migrations
выполняет по порядку те файлы, которых в базе ещё не было, и записывает их имена
в таблицу schema_migrations. Так база у тебя, на сервере и в тестах всегда одинаковая.

Чтобы поменять базу (добавить поле, таблицу), создай новый файл со следующим номером.
Старые файлы не трогай: на сервере они уже выполнены и второй раз не запустятся.
"""

from pathlib import Path

from .db import Connection, now

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def apply_migrations(db: Connection) -> list[str]:
    """Выполняет недостающие миграции и возвращает имена тех, что выполнила."""
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name       TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
        """
    )
    # Если сервер запустили дважды одновременно, второй подождёт здесь, пока первый
    # закончит, и не станет выполнять те же миграции ещё раз
    db.execute("LOCK TABLE schema_migrations")
    done = {row["name"] for row in db.execute("SELECT name FROM schema_migrations")}

    applied = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if path.name in done:
            continue
        db.execute(path.read_text(encoding="utf-8"))
        db.execute("INSERT INTO schema_migrations (name, applied_at) VALUES (%s, %s)", (path.name, now()))
        applied.append(path.name)
    return applied
