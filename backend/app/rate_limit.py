"""
Ограничение частоты запросов: чтобы бот не завалил сервер и не насоздавал тысячи гостей.

Как устроено: для каждого «ключа» (адрес IP или id пользователя) помним время последних
запросов. Если за последние N секунд их уже больше лимита, отвечаем 429 «Слишком много
запросов» и ничего не делаем.

Счётчики живут в памяти процесса: бэкенд у нас один (см. deploy/docker-compose.yml),
поэтому этого достаточно. После перезапуска сервера счётчики начинаются заново — не страшно.
"""

import time
from collections import deque

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from . import defaults


class RateLimiter:
    def __init__(self, limit: int, period_seconds: int):
        self.limit = limit
        self.period_seconds = period_seconds
        # ключ → времена недавних запросов, от старых к новым
        self.hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        """Учитывает запрос. False — лимит исчерпан, запрос надо отклонить."""
        current = time.monotonic()
        hits = self.hits.setdefault(key, deque())
        # Забываем запросы старше периода
        while hits and hits[0] <= current - self.period_seconds:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(current)
        # Иногда выбрасываем ключи, от которых давно не было запросов, чтобы память не росла
        if len(self.hits) > 10_000:
            self.hits = {k: v for k, v in self.hits.items() if v and v[-1] > current - self.period_seconds}
        return True

    def check(self, key: str) -> None:
        """Как allow(), но при превышении сразу отвечает клиенту 429."""
        if not self.allow(key):
            raise HTTPException(status_code=429, detail="Слишком много запросов, попробуй через минуту")

    def reset(self) -> None:
        self.hits.clear()


# Все запросы к API с одного адреса. Лимит щедрый: обычной работе с доской он не мешает
any_request = RateLimiter(*defaults.RATE_LIMIT_ANY_REQUEST)
# Создание гостя: каждый новый браузер без cookie — новый пользователь в базе
new_guest = RateLimiter(*defaults.RATE_LIMIT_NEW_GUEST)
# Вход через DonationAlerts
login = RateLimiter(*defaults.RATE_LIMIT_LOGIN)
# Секретные ссылки (зрителей и приглашения): чтобы их нельзя было подбирать перебором
secret_link = RateLimiter(*defaults.RATE_LIMIT_SECRET_LINK)
# Новые карточки вручную, на одного пользователя
new_card = RateLimiter(*defaults.RATE_LIMIT_NEW_CARD)

ALL_LIMITERS = [any_request, new_guest, login, secret_link, new_card]


def client_ip(request: Request) -> str:
    # Настоящий адрес посетителя: Caddy передаёт его бэкенду, а uvicorn подставляет
    # в request.client (запуск с --proxy-headers, см. backend/Dockerfile)
    return request.client.host if request.client else "unknown"


async def limit_all_requests(request: Request, call_next):
    """Общий лимит на все запросы к API с одного адреса."""
    if request.url.path.startswith("/api/") and not any_request.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"detail": "Слишком много запросов, попробуй через минуту"})
    return await call_next(request)


def limit_secret_link(request: Request) -> None:
    """Подключается к эндпоинтам с секретной ссылкой: Depends(limit_secret_link)."""
    secret_link.check(client_ip(request))


def limit_login(request: Request) -> None:
    login.check(client_ip(request))
