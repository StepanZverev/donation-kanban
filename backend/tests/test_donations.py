from app.db import connect
from app.donationalerts.listener import to_donation
from app.donations import Donation, add_donation_card, split_message

from .helpers import default_board_id


def test_fake_donation_creates_card_in_incoming(client):
    assert client.post("/api/dev/fake-donation").status_code == 201

    [incoming] = [c for c in client.get("/api/columns").json() if c["kind"] == "incoming"]
    [card] = client.get("/api/cards").json()
    assert card["source"] == "donationalerts"
    assert card["column_id"] == incoming["id"]
    assert card["streamer_amount"] == card["amount"]
    # Ник может быть пустым: тестовый донат иногда анонимный
    assert card["donor_name"] is not None
    assert card["amount"] > 0


def test_same_donation_is_added_once(client):
    donation = Donation(
        id=42, username="Вася", message="Привет", amount=100, currency="RUB", streamer_amount=100
    )
    with connect() as db:
        assert add_donation_card(db, default_board_id(db), donation) is True
        assert add_donation_card(db, default_board_id(db), donation) is False

    assert len(client.get("/api/cards").json()) == 1


def test_split_message():
    assert split_message("  Привет  ") == ("Привет", "")
    assert split_message("") == ("Донат без сообщения", "")

    long_message = "а" * 200
    title, description = split_message(long_message)
    assert len(title) == 80 and title.endswith("…")
    assert description == long_message


def test_websocket_gets_notified_about_changes(client):
    with client.websocket_connect("/api/ws") as websocket:
        client.post("/api/cards", json={"text": "Новая"})
        assert websocket.receive_json() == {"type": "board_changed"}

        client.post("/api/dev/fake-donation")
        assert websocket.receive_json() == {"type": "board_changed"}


def test_streamer_amount_from_donationalerts():
    data = {"id": 1, "username": "John", "message": "Hi", "amount": 5, "currency": "USD"}
    # DonationAlerts прислал сумму в валюте стримера
    assert to_donation({**data, "amount_in_user_currency": 450.5}).streamer_amount == 450.5
    # Поля нет — берём сумму как есть
    assert to_donation(data).streamer_amount == 5
