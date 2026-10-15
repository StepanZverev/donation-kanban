"""
Пользователи и сессии.

Как бэкенд узнаёт, кто пришёл:
1. При первом визите браузер ещё ничего не знает. Мы создаём пользователя-гостя
   и сессию: длинную случайную строку (токен), которую браузер хранит в cookie.
2. С каждым запросом браузер сам присылает эту cookie. По ней мы находим сессию,
   а по сессии — пользователя.
3. Когда гость подключает DonationAlerts, к нему добавляется способ входа
   (строка в user_logins). Теперь, войдя через DonationAlerts на другом устройстве,
   он попадёт в этого же пользователя.

Паролей нет: «войти» — значит подтвердить в DonationAlerts, что это твой аккаунт.
"""

import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Request, Response

from . import config
from .db import get_db, now

# Имя cookie, в которой браузер хранит токен сессии
SESSION_COOKIE = "session"
# Сколько живёт сессия. Гостю нельзя войти заново, поэтому срок долгий.
SESSION_DAYS = 365

DONATIONALERTS = "donationalerts"


def hash_token(token: str) -> str:
    """
    Хэш токена: по нему нельзя восстановить сам токен.
    В базе храним только хэш, поэтому даже с копией базы чужую сессию не подделать.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def create_user(db: sqlite3.Connection) -> int:
    """Создаёт нового пользователя-гостя и возвращает его id."""
    timestamp = now()
    cursor = db.execute(
        "INSERT INTO users (created_at, last_seen_at) VALUES (?, ?)",
        (timestamp, timestamp),
    )
    return cursor.lastrowid


def get_user(db: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def update_profile(db: sqlite3.Connection, user_id: int, name: str | None, avatar_url: str | None) -> None:
    db.execute("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?", (name, avatar_url, user_id))


def create_session(db: sqlite3.Connection, user_id: int) -> str:
    """Создаёт сессию и возвращает токен, который нужно положить в cookie."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (hash_token(token), user_id, now(), expires_at.isoformat(timespec="seconds")),
    )
    return token


def find_session_user(db: sqlite3.Connection, token: str | None) -> sqlite3.Row | None:
    """Пользователь по токену из cookie. None — если токена нет, он чужой или сессия истекла."""
    if not token:
        return None
    return db.execute(
        """
        SELECT users.* FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
        """,
        (hash_token(token), now()),
    ).fetchone()


def delete_session(db: sqlite3.Connection, token: str) -> None:
    db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))


def find_user_by_login(db: sqlite3.Connection, provider: str, provider_user_id: str) -> int | None:
    """id пользователя, к которому привязан этот аккаунт DonationAlerts (или другого сервиса)."""
    row = db.execute(
        "SELECT user_id FROM user_logins WHERE provider = ? AND provider_user_id = ?",
        (provider, provider_user_id),
    ).fetchone()
    return row["user_id"] if row else None


def add_login(db: sqlite3.Connection, user_id: int, provider: str, provider_user_id: str) -> None:
    db.execute(
        "INSERT INTO user_logins (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)",
        (provider, provider_user_id, user_id, now()),
    )


def list_logins(db: sqlite3.Connection, user_id: int) -> list[str]:
    """Чем пользователь может войти, например ['donationalerts']. Пустой список — гость."""
    rows = db.execute("SELECT provider FROM user_logins WHERE user_id = ? ORDER BY provider", (user_id,))
    return [row["provider"] for row in rows]


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        # JavaScript на странице cookie не видит — её не украсть через чужой скрипт
        httponly=True,
        # Чужие сайты не могут отправить запрос с этой cookie от твоего имени
        samesite="lax",
        secure=config.COOKIE_SECURE,
    )


def get_current_user(
    request: Request,
    response: Response,
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    """
    Кто сделал запрос. Если браузер пришёл впервые (или cookie потерялась),
    создаём гостя и отдаём браузеру новую cookie.

    Подключается к эндпоинту так: `user = Depends(get_current_user)`.
    """
    user = find_session_user(db, request.cookies.get(SESSION_COOKIE))
    if user is None:
        user_id = create_user(db)
        set_session_cookie(response, create_session(db, user_id))
    else:
        user_id = user["id"]
        db.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (now(), user_id))
    return get_user(db, user_id)
