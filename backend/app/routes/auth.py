"""
Подключение DonationAlerts и статус подключения.

Подключение DA заодно работает как вход: аккаунт DA привязывается к пользователю,
и с другого устройства можно войти в того же пользователя через DA.
"""

import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from .. import config
from ..db import get_db
from ..donationalerts import client
from ..donationalerts.listener import (
    ACCESS_TOKEN,
    donation_listener,
    forget_tokens,
    read_setting,
    remember_newest_donation,
    save_tokens,
)
from ..users import (
    DONATIONALERTS,
    SESSION_COOKIE,
    add_login,
    create_session,
    create_user,
    delete_session,
    find_session_user,
    find_user_by_login,
    set_session_cookie,
    update_profile,
)

router = APIRouter(prefix="/api/auth", tags=["DonationAlerts"])

# Cookie со случайной строкой текущего входа (см. state в client.build_authorize_url).
# Хранится в браузере, поэтому двое могут входить одновременно и не мешать друг другу.
STATE_COOKIE = "da_oauth_state"
STATE_MAX_AGE_SECONDS = 10 * 60


@router.get("/status")
def status() -> dict:
    """Подключён ли DonationAlerts и слушаем ли мы донаты прямо сейчас."""
    return {
        "configured": config.is_donationalerts_configured(),
        "connected": read_setting(ACCESS_TOKEN) is not None,
        "listener": donation_listener.status,
    }


@router.get("/login")
def login() -> RedirectResponse:
    """Отправляет браузер на страницу DonationAlerts, где пользователь разрешает доступ."""
    if not config.is_donationalerts_configured():
        raise HTTPException(
            status_code=400,
            detail="Не заданы DA_CLIENT_ID и DA_CLIENT_SECRET в backend/.env",
        )
    state = secrets.token_urlsafe(16)
    response = RedirectResponse(client.build_authorize_url(state))
    response.set_cookie(
        STATE_COOKIE,
        state,
        max_age=STATE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
    )
    return response


@router.get("/callback")
async def callback(
    code: str,
    state: str,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
) -> RedirectResponse:
    """Сюда DonationAlerts возвращает браузер после того, как пользователь разрешил доступ."""
    expected_state = request.cookies.get(STATE_COOKIE)
    # compare_digest сравнивает строки за одинаковое время, чтобы state нельзя было подобрать
    if expected_state is None or not secrets.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="Вход устарел или начат не отсюда, попробуй ещё раз")

    tokens = await client.exchange_code(code)
    save_tokens(tokens)
    await remember_newest_donation(tokens["access_token"])
    await donation_listener.restart()

    # Возвращаем пользователя на доску
    response = RedirectResponse(config.FRONTEND_URL)
    response.delete_cookie(STATE_COOKIE)

    # Кто сейчас открыл сайт в этом браузере (обычно гость) и чей это аккаунт DA
    session_token = request.cookies.get(SESSION_COOKIE)
    current_user = find_session_user(db, session_token)
    profile = await client.get_user(tokens["access_token"])
    user_id = choose_user(db, str(profile["id"]), current_user)
    update_profile(db, user_id, profile.get("name"), profile.get("avatar"))

    if current_user is None or current_user["id"] != user_id:
        # Браузер был у другого пользователя (или ни у кого) — переключаем его сессию
        if session_token:
            delete_session(db, session_token)
        set_session_cookie(response, create_session(db, user_id))
    return response


def choose_user(db: sqlite3.Connection, da_user_id: str, current_user: sqlite3.Row | None) -> int:
    """
    В какого пользователя войти после подключения DonationAlerts:
    - этот аккаунт DA уже привязан к кому-то — входим в него (например, с нового устройства);
    - иначе привязываем DA к тому, кто сейчас открыл сайт (гость становится «настоящим»);
    - а если браузер пришёл без сессии — создаём нового пользователя.
    """
    owner_id = find_user_by_login(db, DONATIONALERTS, da_user_id)
    if owner_id is not None:
        return owner_id
    user_id = current_user["id"] if current_user else create_user(db)
    add_login(db, user_id, DONATIONALERTS, da_user_id)
    return user_id


@router.post("/logout")
async def logout() -> dict:
    """Отключает DonationAlerts: забываем токены и перестаём слушать донаты."""
    forget_tokens()
    await donation_listener.restart()
    return {"status": "ok"}
