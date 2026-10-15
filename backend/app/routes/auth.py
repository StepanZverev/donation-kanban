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
from ..board import create_board, find_user_board, move_cards_to_board
from ..db import get_db, set_setting
from ..donationalerts import client
from ..donationalerts.listener import (
    ACCESS_TOKEN,
    OWNER_USER_ID,
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
    get_current_user,
    list_logins,
    set_session_cookie,
    update_profile,
)

router = APIRouter(prefix="/api/auth", tags=["DonationAlerts"])

# Cookie со случайной строкой текущего входа (см. state в client.build_authorize_url).
# Хранится в браузере, поэтому двое могут входить одновременно и не мешать друг другу.
STATE_COOKIE = "da_oauth_state"
STATE_MAX_AGE_SECONDS = 10 * 60


@router.get("/status")
def status(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    """
    Подключён ли DonationAlerts и слушаем ли мы донаты прямо сейчас.
    Подключение пока одно на весь сервер, поэтому другим пользователям
    показываем «не подключён»: донаты идут не на их доску.
    """
    if not is_donationalerts_owner(user):
        return {
            "configured": config.is_donationalerts_configured(),
            "connected": False,
            "listener": "not_connected",
        }
    return {
        "configured": config.is_donationalerts_configured(),
        "connected": read_setting(ACCESS_TOKEN) is not None,
        "listener": donation_listener.status,
    }


def is_donationalerts_owner(user: sqlite3.Row) -> bool:
    """
    Этот ли пользователь подключил DonationAlerts. Если подключили ещё до появления
    пользователей (хозяин неизвестен), считаем, что подключение общее.
    """
    owner_id = read_setting(OWNER_USER_ID)
    return owner_id is None or int(owner_id) == user["id"]


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

    # Кто сейчас открыл сайт в этом браузере (обычно гость) и чей это аккаунт DA
    session_token = request.cookies.get(SESSION_COOKIE)
    current_user = find_session_user(db, session_token)
    profile = await client.get_user(tokens["access_token"])
    user_id = choose_user(db, str(profile["id"]), current_user)
    update_profile(db, user_id, profile.get("name"), profile.get("avatar"))
    if current_user is not None and current_user["id"] != user_id:
        take_guest_cards(db, current_user, user_id)
    # Донаты теперь падают на доску этого пользователя
    set_setting(db, OWNER_USER_ID, str(user_id))
    # Сохраняем сразу: функции ниже пишут в базу через своё соединение,
    # и SQLite не даст им писать, пока это соединение держит несохранённые изменения
    db.commit()

    save_tokens(tokens)
    await remember_newest_donation(tokens["access_token"])
    await donation_listener.restart()

    # Возвращаем пользователя на доску
    response = RedirectResponse(config.FRONTEND_URL)
    response.delete_cookie(STATE_COOKIE)
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


def take_guest_cards(db: sqlite3.Connection, guest: sqlite3.Row, user_id: int) -> None:
    """
    Гость вошёл в аккаунт, который уже есть (например, после «Выйти» или с нового устройства).
    Его карточки переезжают на доску аккаунта, чтобы не потеряться.
    Если до входа это был не гость, а другой аккаунт, его доску не трогаем.
    """
    guest_board_id = find_user_board(db, guest["id"])
    if list_logins(db, guest["id"]) or guest_board_id is None:
        return
    user_board_id = find_user_board(db, user_id) or create_board(db, user_id)
    move_cards_to_board(db, guest_board_id, user_board_id)


@router.post("/logout")
async def logout(user: sqlite3.Row = Depends(get_current_user)) -> dict:
    """Отключает DonationAlerts: забываем токены и перестаём слушать донаты."""
    if not is_donationalerts_owner(user):
        raise HTTPException(status_code=403, detail="DonationAlerts подключал другой пользователь")
    forget_tokens()
    await donation_listener.restart()
    return {"status": "ok"}
