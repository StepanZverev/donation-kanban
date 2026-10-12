"""
Запросы к API DonationAlerts (документация: https://www.donationalerts.com/apidoc).

Как устроен вход (OAuth):
1. Пользователь жмёт «Подключить DonationAlerts», мы отправляем его браузер
   на страницу DA (build_authorize_url).
2. Он разрешает доступ, DA возвращает браузер на наш /api/auth/callback с кодом.
3. Мы меняем этот код на токен доступа (exchange_code) и сохраняем токен в базе.
С токеном можно читать донаты и подписываться на новые.
"""

from urllib.parse import urlencode

import httpx2

from .. import config

BASE_URL = "https://www.donationalerts.com"

# Что мы просим разрешить:
# oauth-user-show          — узнать id пользователя и токен для WebSocket
# oauth-donation-subscribe — получать новые донаты в реальном времени
# oauth-donation-index     — читать список донатов (для догрузки пропущенных)
SCOPES = "oauth-user-show oauth-donation-subscribe oauth-donation-index"

# Отдельный клиент, чтобы в тестах можно было подменить его на поддельный.
http = httpx2.AsyncClient(base_url=BASE_URL, timeout=15)


class TokenExpiredError(Exception):
    """DA ответил 401: токен больше не действует."""


def build_authorize_url(state: str) -> str:
    """Адрес страницы DA, где пользователь разрешает доступ."""
    params = {
        "client_id": config.DA_CLIENT_ID,
        "redirect_uri": config.DA_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        # state — случайная строка, которую DA вернёт нам обратно.
        # Сверяя её, мы убеждаемся, что вход начали именно мы.
        "state": state,
    }
    return f"{BASE_URL}/oauth/authorize?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Меняет одноразовый код из callback на токены. Возвращает access_token, refresh_token и т.д."""
    response = await http.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": config.DA_CLIENT_ID,
            "client_secret": config.DA_CLIENT_SECRET,
            "redirect_uri": config.DA_REDIRECT_URI,
            "code": code,
        },
    )
    response.raise_for_status()
    return response.json()


async def refresh_tokens(refresh_token: str) -> dict:
    """Получает новый access_token по refresh_token."""
    response = await http.post(
        "/oauth/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": config.DA_CLIENT_ID,
            "client_secret": config.DA_CLIENT_SECRET,
            "scope": SCOPES,
        },
    )
    response.raise_for_status()
    return response.json()


async def get_user(access_token: str) -> dict:
    """Профиль пользователя: id и socket_connection_token для WebSocket."""
    body = await _get("/api/v1/user/oauth", access_token)
    return body["data"]


async def get_donations(access_token: str, page: int = 1) -> list[dict]:
    """Одна страница донатов, сначала самые новые."""
    body = await _get(f"/api/v1/alerts/donations?page={page}", access_token)
    return body["data"]


async def get_channel_token(access_token: str, client_id: str, channel: str) -> str:
    """Токен для подписки на канал в WebSocket DA (Centrifugo)."""
    response = await http.post(
        "/api/v1/centrifuge/subscribe",
        json={"channels": [channel], "client": client_id},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    _raise_for_status(response)
    return response.json()["channels"][0]["token"]


async def _get(url: str, access_token: str) -> dict:
    response = await http.get(url, headers={"Authorization": f"Bearer {access_token}"})
    _raise_for_status(response)
    # Ответы DA завёрнуты в {"data": ...}
    return response.json()


def _raise_for_status(response: httpx2.Response) -> None:
    if response.status_code == 401:
        raise TokenExpiredError()
    response.raise_for_status()
