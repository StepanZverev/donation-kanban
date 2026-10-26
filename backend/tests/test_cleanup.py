"""Уборка базы: брошенные гости и просроченные сессии (app/cleanup.py)."""

from app.cleanup import clean_up
from app.db import connect

from .helpers import BoardClient

LONG_AGO = "2020-01-01T00:00:00.000+00:00"


def user_ids() -> set[int]:
    with connect() as db:
        return {row["id"] for row in db.execute("SELECT id FROM users")}


def make_long_ago(user_id: int) -> None:
    """Делаем вид, что пользователь не заходил много лет."""
    with connect() as db:
        db.execute("UPDATE users SET last_seen_at = %s WHERE id = %s", (LONG_AGO, user_id))


def run_clean_up() -> None:
    with connect() as db:
        clean_up(db)


def test_abandoned_guest_with_empty_board_is_deleted(client):
    guest_id = client.get("/api/me").json()["id"]
    make_long_ago(guest_id)

    run_clean_up()

    assert guest_id not in user_ids()
    with connect() as db:
        assert db.execute("SELECT count(*) AS n FROM boards").fetchone()["n"] == 0
        assert db.execute("SELECT count(*) AS n FROM board_columns").fetchone()["n"] == 0


def test_recent_guest_is_kept(client):
    guest_id = client.get("/api/me").json()["id"]

    run_clean_up()

    assert guest_id in user_ids()


def test_guest_with_cards_is_kept(client):
    guest_id = client.get("/api/me").json()["id"]
    card_id = client.post("/api/cards", json={"text": "Заказ"}).json()["id"]
    # Даже если карточка уже в истории, доска не пустая
    client.delete(f"/api/cards/{card_id}")
    make_long_ago(guest_id)

    run_clean_up()

    assert guest_id in user_ids()


def test_guest_moderator_is_kept(client):
    owner_board = client.get("/api/me").json()["board_id"]
    moderator = BoardClient(client.app)
    moderator_id = moderator.get("/api/me").json()["id"]
    token = client.post(f"/api/boards/{owner_board}/invite-link").json()["invite_token"]
    moderator.post(f"/api/invites/{token}/accept")
    make_long_ago(moderator_id)

    run_clean_up()

    assert moderator_id in user_ids()


def test_expired_sessions_are_deleted(client):
    client.get("/api/me")
    with connect() as db:
        db.execute("UPDATE sessions SET expires_at = %s", (LONG_AGO,))

    run_clean_up()

    with connect() as db:
        assert db.execute("SELECT count(*) AS n FROM sessions").fetchone()["n"] == 0
