from app.db import connect
from app.donations import Donation, add_donation_card


def donate(donation_id: int, username: str = "Вася", amount: float = 100) -> None:
    donation = Donation(
        id=donation_id, username=username, message="Привет", amount=amount, currency="RUB", streamer_amount=amount
    )
    with connect() as db:
        add_donation_card(db, donation)


def stream_total(client) -> dict:
    return client.get("/api/stream-total").json()


def test_stream_total_counts_donations(client):
    assert stream_total(client) == {"total": 0, "donation_count": 0, "board_card_count": 0}

    donate(1, amount=100)
    donate(2, amount=250)
    client.post("/api/cards", json={"title": "Ручная"})

    assert stream_total(client) == {"total": 350, "donation_count": 2, "board_card_count": 3}


def test_clearing_columns_keeps_stream_total(client):
    donate(1, amount=100)
    client.post("/api/cards/clear-queue")

    assert stream_total(client) == {"total": 100, "donation_count": 1, "board_card_count": 0}


def test_merged_donations_are_not_counted_twice(client):
    donate(1, username="Вася", amount=100)
    donate(2, username="Вася", amount=50)
    first, second = sorted(client.get("/api/cards").json(), key=lambda card: card["id"])
    client.post(f"/api/cards/{first['id']}/merge", json={"card_ids": [second["id"]]})

    assert stream_total(client) == {"total": 150, "donation_count": 2, "board_card_count": 1}


def test_reset_board(client):
    columns = client.get("/api/columns").json()
    done_id = next(column["id"] for column in columns if column["kind"] == "done")
    donate(1, amount=100)
    donate(2, amount=200)
    finished = client.get("/api/cards").json()[0]
    client.post(f"/api/cards/{finished['id']}/move", json={"column_id": done_id})

    assert client.post("/api/board/reset").json() == {"total": 0, "donation_count": 0, "board_card_count": 0}

    assert client.get("/api/cards").json() == []
    reasons = {card["id"]: card["archive_reason"] for card in client.get("/api/history").json()}
    assert reasons[finished["id"]] == "done"
    assert sorted(reasons.values()) == ["deleted", "done"]

    # После сброса сумма копится заново
    donate(3, amount=70)
    assert stream_total(client)["total"] == 70
