"""Объединение карточек одного донатера."""

from app.db import connect
from app.donations import Donation, add_donation_card

next_donation_id = iter(range(1, 1000))


def donate(username, amount, message, currency="RUB", streamer_amount=None):
    donation = Donation(
        id=next(next_donation_id),
        username=username,
        message=message,
        amount=amount,
        currency=currency,
        streamer_amount=amount if streamer_amount is None else streamer_amount,
    )
    with connect() as db:
        add_donation_card(db, donation)


def columns(client):
    return {column["kind"]: column["id"] for column in client.get("/api/columns").json()}


def board(client):
    return client.get("/api/cards").json()


def card_by_message(client, message):
    return next(card for card in board(client) if message in (card["description"] or card["title"]))


def merge(client, card):
    return client.post(f"/api/cards/{card['id']}/merge")


def test_merge_two_cards_in_queue_into_older(client):
    donate("Вася", 200, "Расскажи, как ты начал стримить")
    donate("вася", 300, "И про первый стрим тоже!")
    newer = card_by_message(client, "И про первый стрим")

    response = merge(client, newer)
    assert response.status_code == 200

    cards = board(client)
    assert len(cards) == 1
    merged = cards[0]
    assert merged["amount"] == 500
    assert merged["streamer_amount"] == 500
    assert merged["merge_count"] == 2
    assert merged["description"] == "Расскажи, как ты начал стримить\n⸻\nИ про первый стрим тоже!"
    assert merged["last_merge_note"] == "+300 ₽ от вася"

    history = client.get("/api/history").json()
    assert [(card["archive_reason"], card["merged_into_id"]) for card in history] == [("merged", merged["id"])]


def test_merge_goes_into_card_in_work_column(client):
    donate("Вася", 100, "Старый")
    donate("Вася", 100, "Средний")
    donate("Вася", 50, "Новый")
    middle = card_by_message(client, "Средний")
    client.post(f"/api/cards/{middle['id']}/move", json={"column_id": columns(client)["work"]})

    merge(client, card_by_message(client, "Новый"))

    work_card = next(card for card in board(client) if card["column_id"] == columns(client)["work"])
    assert work_card["id"] == middle["id"]
    assert work_card["amount"] == 150


def test_oldest_card_in_queue_cannot_be_merged(client):
    donate("Вася", 100, "Старый")
    donate("Вася", 100, "Новый")
    assert merge(client, card_by_message(client, "Старый")).status_code == 400


def test_other_donor_and_done_are_not_merged(client):
    donate("Петя", 100, "Петин")
    donate("Вася", 100, "Васин старый")
    old = card_by_message(client, "Васин старый")
    client.post(f"/api/cards/{old['id']}/move", json={"column_id": columns(client)["done"]})
    donate("Вася", 100, "Васин новый")

    assert merge(client, card_by_message(client, "Васин новый")).status_code == 400


def test_undo_merge_returns_everything_back(client):
    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")
    second = card_by_message(client, "Второй")
    merge(client, second)

    response = client.post(f"/api/history/{second['id']}/restore", json={"column_id": columns(client)["incoming"]})
    assert response.status_code == 200

    first = card_by_message(client, "Первый")
    assert (first["amount"], first["description"], first["merge_count"]) == (200, "", 1)
    assert card_by_message(client, "Второй")["amount"] == 300
    assert client.get("/api/history").json() == []


def test_donation_without_message_has_no_separator(client):
    """Если у одного из донатов нет текста, разделитель не ставим."""
    donate("Вася", 200, "")
    donate("Вася", 300, "Теперь с текстом")
    second = card_by_message(client, "Теперь с текстом")
    merge(client, second)
    assert board(client)[0]["description"] == "Теперь с текстом"

    # Отмена тоже работает: описание снова пустое
    client.post(f"/api/history/{second['id']}/restore", json={"column_id": columns(client)["incoming"]})
    first = next(card for card in board(client) if card["id"] != second["id"])
    assert first["description"] == ""


def test_new_donation_without_message_keeps_text(client):
    donate("Вася", 200, "Текст первого")
    donate("Вася", 300, "")
    second = next(card for card in board(client) if card["amount"] == 300)
    merge(client, second)
    assert board(client)[0]["description"] == "Текст первого"


def test_different_currencies_use_streamer_currency(client):
    donate("John", 200, "Рубли")
    donate("John", 5, "Доллары", currency="USD", streamer_amount=450)
    merge(client, card_by_message(client, "Доллары"))

    card = board(client)[0]
    assert (card["amount"], card["currency"], card["streamer_amount"]) == (650, "RUB", 650)
    assert card["description"] == "Рубли\n⸻\nДоллары"
    assert card["last_merge_note"] == "+5 $ от John"


def test_auto_merge(client):
    assert client.get("/api/settings/auto-merge").json() == {"enabled": False}
    client.put("/api/settings/auto-merge", json={"enabled": True})

    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")

    cards = board(client)
    assert len(cards) == 1
    assert cards[0]["amount"] == 500


def test_no_auto_merge_when_disabled(client):
    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")
    assert len(board(client)) == 2
