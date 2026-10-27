"""
Кто я: текущий пользователь, выход и удаление аккаунта.

Отдельной страницы входа нет: первый же запрос к /api/me создаёт гостя
(см. users.get_current_user). Войти «по-настоящему» — значит подключить
DonationAlerts (routes/auth.py).
"""


from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import config
from ..board import find_or_create_user_board
from ..cleanup import delete_users
from ..db import Connection, Row, get_db
from ..donationalerts.listener import donation_listeners
from ..schemas import CurrentUser
from ..users import SESSION_COOKIE, delete_session, get_current_user, list_logins
from .members import list_moderated_boards

router = APIRouter(prefix="/api/me", tags=["Пользователь"])


@router.get("")
def get_me(
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
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
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
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


@router.delete("")
async def delete_account(
    response: Response,
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
) -> dict:
    """
    «Удалить аккаунт и все данные»: доска, карточки, история, подключение DonationAlerts,
    модераторы и модераторство — всё сразу и насовсем. Браузер забывает cookie,
    следующий визит начнётся с нового гостя.
    """
    # Сначала перестаём слушать донаты, чтобы новый донат не создал карточку на удалённой доске
    await donation_listeners.stop(user["id"])
    delete_users(db, [user["id"]])
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}
