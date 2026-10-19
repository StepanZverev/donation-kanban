from app.db import connect
from app.donationalerts.listener import to_donation
from app.donations import Donation, add_donation_card

from .helpers import default_board_id

INTAKE_DEFAULTS = {"open": True, "min_amount": 0, "ignore_anonymous": False}


def donate(donation_id: int, username: str = "Вася", amount: float = 100) -> None:
    donation = Donation(
        id=donation_id, username=username, message="Привет", amount=amount, currency="RUB", streamer_amount=amount
    )
    with connect() as db:
        add_donation_card(db, default_board_id(db), donation)


def set_intake(client, **changes) -> None:
    response = client.put("/api/settings/intake", json={**INTAKE_DEFAULTS, **changes})
    assert response.status_code == 200


def test_default_intake_settings(client):
    assert client.get("/api/settings/intake").json() == INTAKE_DEFAULTS


def test_save_intake_settings(client):
    set_intake(client, open=False, min_amount=150, ignore_anonymous=True)
    assert client.get("/api/settings/intake").json() == {"open": False, "min_amount": 150, "ignore_anonymous": True}


def test_min_amount_cannot_be_negative(client):
    assert client.put("/api/settings/intake", json={**INTAKE_DEFAULTS, "min_amount": -1}).status_code == 422


def test_closed_intake_sends_donation_to_history(client):
    set_intake(client, open=False)
    donate(1)

    assert client.get("/api/cards").json() == []
    [card] = client.get("/api/history", params={"reason": "rejected"}).json()
    assert card["archive_note"] == "Приём был закрыт"


def test_donation_below_min_amount_goes_to_history(client):
    set_intake(client, min_amount=100)
    donate(1, amount=99)
    donate(2, amount=100)

    [on_board] = client.get("/api/cards").json()
    assert on_board["amount"] == 100
    [filtered] = client.get("/api/history").json()
    assert filtered["archive_reason"] == "rejected"
    assert filtered["archive_note"] == "Меньше минимальной суммы"


def test_anonymous_donations_can_be_ignored(client):
    donate(1, username="")
    assert len(client.get("/api/cards").json()) == 1

    set_intake(client, ignore_anonymous=True)
    donate(2, username="")
    donate(3, username="Вася")

    assert len(client.get("/api/cards").json()) == 2
    [filtered] = client.get("/api/history").json()
    assert filtered["archive_note"] == "Анонимный донат"


def test_filtered_donation_can_be_returned_to_board(client):
    set_intake(client, open=False)
    donate(1)
    [card] = client.get("/api/history").json()

    assert client.post(f"/api/history/{card['id']}/restore").status_code == 200
    [restored] = client.get("/api/cards").json()
    assert restored["archive_reason"] is None
    assert restored["archive_note"] is None


def test_anonymous_donation_is_stored_without_name():
    data = {"id": 1, "username": None, "message": "Hi", "amount": 5, "currency": "RUB"}
    assert to_donation(data).username == ""


def test_anonymous_donations_are_not_auto_merged(client):
    client.put("/api/settings/auto-merge", json={"enabled": True})
    donate(1, username="")
    donate(2, username="")
    assert len(client.get("/api/cards").json()) == 2


def test_latest_donations(client):
    assert client.get("/api/cards/latest-donations").json() == {"on_board": None, "to_history": None}

    donate(1)
    on_board = client.get("/api/cards/latest-donations").json()["on_board"]
    assert on_board is not None

    set_intake(client, open=False)
    donate(2)
    latest = client.get("/api/cards/latest-donations").json()
    assert latest["on_board"] == on_board
    assert latest["to_history"] > on_board


def test_rejected_by_streamer_is_not_counted_as_filtered(client):
    donate(1)
    [card] = client.get("/api/cards").json()
    client.post(f"/api/cards/{card['id']}/archive", json={"reason": "rejected", "note": "нет"})
    assert client.get("/api/cards/latest-donations").json()["to_history"] is None
