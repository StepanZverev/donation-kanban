import sqlite3

from app.board import create_board


def default_board_id(db: sqlite3.Connection) -> int:
    """
    Доска для тестовых донатов. В большинстве тестов пользователь один, и доска одна.
    Если доски ещё нет, создаём её без хозяина: первый запрос клиента заберёт её себе.
    """
    row = db.execute("SELECT id FROM boards ORDER BY id LIMIT 1").fetchone()
    return row["id"] if row else create_board(db, None)
