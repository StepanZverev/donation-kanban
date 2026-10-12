from app.db import connect
from app.donations import Donation, add_donation_card, split_message


def test_fake_donation_creates_card_in_queue(client):
    assert client.post("/api/dev/fake-donation").status_code == 201

    [card] = client.get("/api/cards").json()
    assert card["source"] == "donationalerts"
    assert card["status"] == "queue"
    assert card["donor_name"]
    assert card["amount"] > 0


def test_same_donation_is_added_once(client):
    donation = Donation(id=42, username="Вася", message="Привет", amount=100, currency="RUB")
    with connect() as db:
        assert add_donation_card(db, donation) is True
        assert add_donation_card(db, donation) is False

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
        client.post("/api/cards", json={"title": "Новая"})
        assert websocket.receive_json() == {"type": "board_changed"}

        client.post("/api/dev/fake-donation")
        assert websocket.receive_json() == {"type": "board_changed"}
