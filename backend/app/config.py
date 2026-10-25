"""
Настройки из файла backend/.env (пример — в .env.example).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Читаем backend/.env, если он есть. Переменные окружения, заданные иначе, не перезаписываются.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DA_CLIENT_ID = os.environ.get("DA_CLIENT_ID", "")
DA_CLIENT_SECRET = os.environ.get("DA_CLIENT_SECRET", "")
DA_REDIRECT_URI = os.environ.get("DA_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173")

# Адрес базы PostgreSQL: postgresql://пользователь:пароль@сервер:порт/имя_базы.
# По умолчанию — база из docker-compose.yml, запущенная на этом же компьютере.
DEFAULT_DATABASE_URL = "postgresql://donation_kanban:donation_kanban@localhost:5432/donation_kanban"


def get_database_url() -> str:
    # Функция, а не переменная: тесты подменяют DATABASE_URL уже после импорта этого файла
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

# Сайт открывается по https — значит, это настоящий сервер, а не запуск на своём компьютере
# (локально сайт работает по http). От этого зависят две настройки ниже.
IS_PRODUCTION = FRONTEND_URL.startswith("https://")

# Отдавать cookie входа только по HTTPS: на настоящем сервере — да, локально по http так нельзя
COOKIE_SECURE = IS_PRODUCTION

# Инструменты для разработки (кнопка «Тестовый донат»): только локально. На настоящем сервере
# выдуманный донат выглядел бы для зрителей как настоящий и попал бы в сумму за стрим.
DEV_TOOLS_ENABLED = not IS_PRODUCTION


def is_donationalerts_configured() -> bool:
    """Вписаны ли ключи приложения DonationAlerts."""
    return bool(DA_CLIENT_ID and DA_CLIENT_SECRET)
