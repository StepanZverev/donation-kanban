"""Перенос данных из старой базы SQLite в PostgreSQL (app/import_sqlite.py)."""

import sqlite3
from pathlib import Path

import pytest

from app.import_sqlite import import_sqlite
from app.users import SESSION_COOKIE, hash_token

OLD_SCHEMA = (Path(__file__).parent / "old_sqlite_schema.sql").read_text(encoding="utf-8")


# Токен из cookie браузера стримера. В базе лежит только его хэш
SESSION_TOKEN = "old-session-token"


def make_old_database(path: Path) -> None:
    """Старая база: стример с DA, его доска с карточкой в «Очереди» и модератор-гость."""
    session_hash = hash_token(SESSION_TOKEN)
    old = sqlite3.connect(path)
    old.executescript(OLD_SCHEMA)
    old.executescript(
        f"""
        INSERT INTO users (id, name, created_at, last_seen_at) VALUES
            (3, 'Стример', '2026-01-01', '2026-01-02'),
            (7, NULL, '2026-01-01', '2026-01-01');
        INSERT INTO user_logins VALUES ('donationalerts', '77', 3, '2026-01-01');
        INSERT INTO sessions VALUES ('{session_hash}', 3, '2026-01-01', '2099-01-01');
        INSERT INTO boards (id, owner_id, created_at) VALUES (5, 3, '2026-01-01');
        INSERT INTO board_settings VALUES (5, 'auto_merge', '1');
        INSERT INTO board_columns (id, board_id, title, kind, position) VALUES
            (10, 5, 'Очередь', 'incoming', 0),
            (11, 5, 'Выполнено', 'done', 1);
        INSERT INTO cards (id, board_id, title, column_id, source, donation_id, donor_name, amount,
                           currency, streamer_amount, created_at, updated_at, moved_at) VALUES
            (20, 5, 'Сыграть катку', 10, 'donationalerts', 9000000001, 'Вася', 150.5, 'RUB', 150.5,
             '2026-01-01', '2026-01-01', '2026-01-01'),
            -- Карточка из удалённой колонки: такая ссылка «в никуда» бывает в старых базах
            (21, 5, 'Потерянная', 99, 'manual', NULL, NULL, NULL, NULL, NULL,
             '2026-01-01', '2026-01-01', '2026-01-01');
        INSERT INTO da_connections VALUES (3, 'access', 'refresh', 9000000001, '2026-01-01');
        INSERT INTO board_members VALUES (5, 7, 'moderator', '2026-01-02', 'Помощник');
        """
    )
    old.close()


def test_old_database_moves_to_postgresql(client, tmp_path):
    make_old_database(tmp_path / "donations.db")

    counts = import_sqlite(tmp_path / "donations.db")
    assert counts["cards"] == 2 and counts["board_members"] == 1

    # Сессия перенеслась: браузер с прежней cookie — снова стример на своей доске
    client.cookies.set(SESSION_COOKIE, SESSION_TOKEN)
    me = client.get("/api/me").json()
    assert (me["name"], me["board_id"]) == ("Стример", 5)

    [card] = client.get("/api/cards").json()
    assert (card["title"], card["amount"], card["donation_id"]) == ("Сыграть катку", 150.5, 9000000001)
    assert client.get("/api/settings/auto-merge").json() == {"enabled": True}
    assert [member["nickname"] for member in client.get("/api/boards/5/members").json()] == ["Помощник"]

    # Новые строки получают id после перенесённых, а не занятые
    new_card = client.post("/api/cards", json={"text": "Новая"}).json()
    assert new_card["id"] == 22


def test_import_refuses_database_with_users(client, tmp_path):
    client.get("/api/me")  # в PostgreSQL уже есть гость
    make_old_database(tmp_path / "donations.db")

    with pytest.raises(SystemExit):
        import_sqlite(tmp_path / "donations.db")
