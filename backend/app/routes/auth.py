"""
Вход в DonationAlerts и статус подключения.
"""

import secrets

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from .. import config
from ..donationalerts import client
from ..donationalerts.listener import (
    ACCESS_TOKEN,
    donation_listener,
    forget_tokens,
    read_setting,
    remember_newest_donation,
    save_tokens,
)

router = APIRouter(prefix="/api/auth", tags=["DonationAlerts"])

# Случайная строка для текущего входа (см. state в client.build_authorize_url)
pending_state: str | None = None


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
    global pending_state
    pending_state = secrets.token_urlsafe(16)
    return RedirectResponse(client.build_authorize_url(pending_state))


@router.get("/callback")
async def callback(code: str, state: str) -> RedirectResponse:
    """Сюда DonationAlerts возвращает браузер после того, как пользователь разрешил доступ."""
    global pending_state
    if pending_state is None or state != pending_state:
        raise HTTPException(status_code=400, detail="Вход устарел или начат не отсюда, попробуй ещё раз")
    pending_state = None

    tokens = await client.exchange_code(code)
    save_tokens(tokens)
    await remember_newest_donation(tokens["access_token"])
    await donation_listener.restart()

    # Возвращаем пользователя на доску
    return RedirectResponse(config.FRONTEND_URL)


@router.post("/logout")
async def logout() -> dict:
    """Отключает DonationAlerts: забываем токены и перестаём слушать донаты."""
    forget_tokens()
    await donation_listener.restart()
    return {"status": "ok"}
