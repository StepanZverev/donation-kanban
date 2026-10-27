"""
Защита от подделки запросов с чужих сайтов (CSRF).

Пример атаки: стример открыл вкладку со злым сайтом, а тот тайком шлёт на наш сервер
POST «удалить все карточки». Браузер сам приложил бы к такому запросу cookie входа.

Браузер в каждом запросе, который что-то меняет (POST, PATCH, PUT, DELETE), пишет заголовок
Origin — адрес сайта, откуда пришёл запрос. Подделать его чужой сайт не может. Поэтому
такие запросы мы пропускаем, только если Origin — наш сайт.

Если заголовка Origin нет совсем, запрос пришёл не из браузера (curl, тесты): cookie входа
у него и так нет, украсть ничего не выйдет — пропускаем.
"""

from urllib.parse import urlsplit

from fastapi import Request
from fastapi.responses import JSONResponse

from . import config

# Запросы, которые только читают, проверять не нужно
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def allowed_origins() -> set[str]:
    """Адреса, с которых можно менять данные: наш сайт."""
    origins = {config.FRONTEND_URL.rstrip("/")}
    # Локально сайт открывают и как 127.0.0.1, и как localhost — это один и тот же компьютер
    if not config.IS_PRODUCTION:
        parts = urlsplit(config.FRONTEND_URL)
        origins.add(f"{parts.scheme}://localhost:{parts.port}")
        origins.add(f"{parts.scheme}://127.0.0.1:{parts.port}")
    return origins


async def check_origin(request: Request, call_next):
    """Отклоняет запрос, который меняет данные и пришёл с чужого сайта."""
    origin = request.headers.get("origin")
    if request.method not in SAFE_METHODS and origin is not None and origin not in allowed_origins():
        return JSONResponse(status_code=403, content={"detail": "Запрос с чужого сайта"})
    return await call_next(request)
