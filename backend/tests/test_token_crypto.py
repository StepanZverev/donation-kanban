"""Токены DonationAlerts лежат в базе зашифрованными (см. app/token_crypto.py)."""

import pytest
from cryptography.fernet import Fernet

from app import config
from app.db import open_db
from app.donationalerts import listener
from app.token_crypto import PREFIX, decrypt_token, encrypt_old_tokens, encrypt_token, get_cipher


def stored_tokens(user_id: int) -> tuple[str, str | None]:
    """Что на самом деле лежит в базе."""
    with open_db() as db:
        row = db.execute("SELECT access_token, refresh_token FROM da_connections WHERE user_id = %s", (user_id,)).fetchone()
    return row["access_token"], row["refresh_token"]


def test_encrypt_and_decrypt():
    encrypted = encrypt_token("secret-token")
    assert encrypted.startswith(PREFIX)
    assert "secret-token" not in encrypted
    assert decrypt_token(encrypted) == "secret-token"


def test_tokens_are_stored_encrypted(client):
    user_id = client.get("/api/me").json()["id"]
    listener.save_connection(user_id, {"access_token": "access-1", "refresh_token": "refresh-1"})

    access, refresh = stored_tokens(user_id)
    assert access.startswith(PREFIX) and refresh.startswith(PREFIX)
    assert "access-1" not in access and "refresh-1" not in refresh

    connection = listener.read_connection(user_id)
    assert (connection["access_token"], connection["refresh_token"]) == ("access-1", "refresh-1")


def test_old_plain_tokens_get_encrypted(client):
    # Так токены лежали до появления шифрования
    user_id = client.get("/api/me").json()["id"]
    with open_db() as db:
        db.execute(
            "INSERT INTO da_connections (user_id, access_token, refresh_token, created_at) VALUES (%s, 'old-access', NULL, 'x')",
            (user_id,),
        )
    # Ещё не зашифрован, но уже читается
    assert listener.read_connection(user_id)["access_token"] == "old-access"

    encrypt_old_tokens()
    access, refresh = stored_tokens(user_id)
    assert access.startswith(PREFIX) and refresh is None
    assert listener.read_connection(user_id)["access_token"] == "old-access"


def test_server_does_not_start_without_key(monkeypatch):
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.delenv("TOKEN_ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError):
        get_cipher()


def test_tokens_under_old_key_reset_connection(client, monkeypatch):
    # Ключ на сервере сменили: подключение сбрасывается, стример просто входит в DA заново
    user_id = client.get("/api/me").json()["id"]
    listener.save_connection(user_id, {"access_token": "access-1"})
    monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())

    assert listener.read_connection(user_id) is None
    with open_db() as db:
        assert db.execute("SELECT COUNT(*) AS n FROM da_connections").fetchone()["n"] == 0
