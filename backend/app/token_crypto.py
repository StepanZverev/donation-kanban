"""
Шифрование токенов DonationAlerts в базе.

Токен DA — это пропуск к донатам стримера. Если кто-то получит копию базы (утечка бэкапа,
взлом), без шифрования он сразу сможет читать чужие донаты. С шифрованием в базе лежит
нечитаемая строка, а расшифровать её можно только ключом из deploy/.env на сервере —
в базе и бэкапах ключа нет.

Шифр — Fernet из библиотеки cryptography: готовый надёжный рецепт (AES + проверка,
что строку никто не подменил).

Зашифрованная строка в базе начинается с «fernet:». Строки без этой приставки — токены,
сохранённые до появления шифрования: их при старте сервера шифрует encrypt_old_tokens().
"""

import logging
import os

from cryptography.fernet import Fernet

from . import config
from .db import open_db

log = logging.getLogger(__name__)

PREFIX = "fernet:"

# Ключ только для запуска на своём компьютере и тестов — там настоящих токенов нет.
# На сервере ключ свой, в deploy/.env (TOKEN_ENCRYPTION_KEY), без него сервер не запустится.
DEV_KEY = "ZGV2LWtleS1kb25hdGlvbi1kZWNrLW5vdC1zZWNyZXQ="


def get_cipher() -> Fernet:
    key = os.environ.get("TOKEN_ENCRYPTION_KEY", "")
    if not key:
        if config.IS_PRODUCTION:
            raise RuntimeError("Не задан TOKEN_ENCRYPTION_KEY в deploy/.env — см. deploy/README.md")
        key = DEV_KEY
    return Fernet(key)


def encrypt_token(token: str) -> str:
    return PREFIX + get_cipher().encrypt(token.encode()).decode()


def decrypt_token(stored: str) -> str:
    # Без приставки — старый незашифрованный токен (до шифрования). Он скоро зашифруется сам
    if not stored.startswith(PREFIX):
        return stored
    return get_cipher().decrypt(stored.removeprefix(PREFIX).encode()).decode()


def encrypt_old_tokens() -> None:
    """Шифрует токены, сохранённые до появления шифрования. Вызывается при старте сервера."""
    # Сразу проверяем ключ: если на сервере его забыли вписать, сервер не запустится
    # и в логе будет понятная ошибка, а не сбой посреди стрима
    get_cipher()
    with open_db() as db:
        rows = db.execute("SELECT user_id, access_token, refresh_token FROM da_connections").fetchall()
        changed = 0
        for row in rows:
            access = row["access_token"]
            refresh = row["refresh_token"]
            if access.startswith(PREFIX) and (refresh is None or refresh.startswith(PREFIX)):
                continue
            db.execute(
                "UPDATE da_connections SET access_token = %s, refresh_token = %s WHERE user_id = %s",
                (
                    access if access.startswith(PREFIX) else encrypt_token(access),
                    refresh if refresh is None or refresh.startswith(PREFIX) else encrypt_token(refresh),
                    row["user_id"],
                ),
            )
            changed += 1
    if changed:
        log.info("Зашифрованы старые токены DonationAlerts: %s", changed)
