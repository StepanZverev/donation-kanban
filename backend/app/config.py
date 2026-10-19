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

# Отдавать cookie только по HTTPS. Локально сайт работает по http, поэтому по умолчанию выключено;
# на настоящем сервере с HTTPS нужно поставить COOKIE_SECURE=1.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"


def is_donationalerts_configured() -> bool:
    """Вписаны ли ключи приложения DonationAlerts."""
    return bool(DA_CLIENT_ID and DA_CLIENT_SECRET)
