"""«Удалить аккаунт и все данные» (DELETE /api/me)."""

from app.db import open_db
from app.donationalerts import listener

from .helpers import BoardClient
from .test_members import board_of, connect_donationalerts, invite, no_listener  # noqa: F401


def count(table: str) -> int:
    with open_db() as db:
        return db.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]


def test_delete_account_removes_everything(client, fake_da, no_listener):  # noqa: F811
    connect_donationalerts(client)
    client.post("/api/cards", json={"text": "Заказ"})
    old_id = client.get("/api/me").json()["id"]
    assert count("da_connections") == 1

    response = client.delete("/api/me")
    assert response.status_code == 200

    for table in ["cards", "boards", "board_columns", "board_settings", "da_connections", "user_logins", "sessions"]:
        assert count(table) == 0, table
    # Браузер забыл cookie: следующий запрос — уже новый гость
    assert client.get("/api/me").json()["id"] != old_id


def test_delete_account_keeps_other_boards(client):
    # Модератор удаляет свой аккаунт: доска хозяина и её карточки на месте, модератора в ней нет
    moderator = BoardClient(client.app)
    board_id = invite(client, moderator)
    client.post("/api/cards", json={"text": "Заказ"})

    assert moderator.delete("/api/me").status_code == 200

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Заказ"]
    members = client.get(f"/api/boards/{board_id}/members").json()
    assert all(member["role"] == "owner" for member in members)


def test_delete_account_stops_listening_to_donations(client, monkeypatch):
    stopped = []

    async def fake_stop(user_id):
        stopped.append(user_id)

    monkeypatch.setattr(listener.donation_listeners, "stop", fake_stop)
    user_id = client.get("/api/me").json()["id"]
    client.delete("/api/me")
    assert stopped == [user_id]
