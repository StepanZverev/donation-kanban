"""
Кто я: текущий пользователь и выход.

Отдельной страницы входа нет: первый же запрос к /api/me создаёт гостя
(см. users.get_current_user). Войти «по-настоящему» — значит подключить
DonationAlerts (routes/auth.py).
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import config
from ..board import find_or_create_user_board
from ..db import get_db
from ..schemas import CurrentUser
from ..users import SESSION_COOKIE, delete_session, get_current_user, list_logins
from .members import list_moderated_boards

router = APIRouter(prefix="/api/me", tags=["Пользователь"])


@router.get("")
def get_me(
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> CurrentUser:
    logins = list_logins(db, user["id"])
    return CurrentUser(
        id=user["id"],
        name=user["name"],
        avatar_url=user["avatar_url"],
        is_guest=not logins,
        logins=logins,
        can_connect_donationalerts=config.is_donationalerts_configured(),
        # Своей доски может ещё не быть (первый визит) — тогда она создаётся здесь
        board_id=find_or_create_user_board(db, user["id"]),
        moderated_boards=list_moderated_boards(db, user["id"]),
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """
    Выйти на этом устройстве. Следующий визит начнётся с нового гостя,
    а вернуться можно, войдя через DonationAlerts.
    """
    if not list_logins(db, user["id"]):
        # Гостю вернуться будет нечем — его доска потеряется
        raise HTTPException(status_code=400, detail="Гостю выйти нельзя: сначала подключи DonationAlerts")
    delete_session(db, request.cookies.get(SESSION_COOKIE, ""))
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}
