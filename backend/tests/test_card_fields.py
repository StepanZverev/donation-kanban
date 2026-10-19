from app.db import connect
from app.donations import Donation, add_donation_card

from .helpers import default_board_id


def donate(donation_id: int, username: str = "Вася", amount: float = 100, currency: str = "RUB", streamer_amount=None):
    donation = Donation(
        id=donation_id,
        username=username,
        message="Привет",
        amount=amount,
        currency=currency,
        streamer_amount=streamer_amount if streamer_amount is not None else amount,
    )
    with connect() as db:
        add_donation_card(db, default_board_id(db), donation)


def test_manual_card_with_nick_and_amount(client):
    card = client.post("/api/cards", json={"text": "Спеть", "donor_name": "  Катя ", "amount": 300}).json()
    assert card["donor_name"] == "Катя"
    assert card["amount"] == 300
    assert card["currency"] == "RUB"
    assert card["streamer_amount"] == 300
    assert client.get("/api/stream-total").json()["total"] == 300


def test_manual_card_without_nick_is_anonymous(client):
    # Как у доната: без ника — аноним (пустая строка), без текста — «Донат без сообщения»
    card = client.post("/api/cards", json={"text": "  ", "donor_name": " "}).json()
    assert card["donor_name"] == ""
    assert card["title"] == "Донат без сообщения"


def test_long_text_is_split_like_donation(client):
    text = "а" * 200
    card = client.post("/api/cards", json={"text": text}).json()
    assert len(card["title"]) == 80 and card["description"] == text

    edited = client.patch(f"/api/cards/{card['id']}", json={"text": "Коротко"}).json()
    assert (edited["title"], edited["description"]) == ("Коротко", "")


def test_manual_card_without_nick_and_amount(client):
    card = client.post("/api/cards", json={"text": "Спеть"}).json()
    assert card["donor_name"] == ""
    assert card["amount"] is None


def test_edit_amount_of_donation(client):
    donate(1, amount=100)
    [card] = client.get("/api/cards").json()

    edited = client.patch(f"/api/cards/{card['id']}", json={"amount": 250}).json()
    assert (edited["amount"], edited["streamer_amount"], edited["currency"]) == (250, 250, "RUB")
    assert edited["title"] == card["title"]
    assert client.get("/api/stream-total").json()["total"] == 250


def test_edit_amount_in_foreign_currency_keeps_rate(client):
    donate(1, amount=5, currency="USD", streamer_amount=450)
    [card] = client.get("/api/cards").json()

    edited = client.patch(f"/api/cards/{card['id']}", json={"amount": 10}).json()
    assert (edited["amount"], edited["currency"], edited["streamer_amount"]) == (10, "USD", 900)


def test_edit_nick(client):
    donate(1, username="Вася")
    [card] = client.get("/api/cards").json()

    assert client.patch(f"/api/cards/{card['id']}", json={"donor_name": "Василий"}).json()["donor_name"] == "Василий"
    # Стёртый ник доната — это аноним
    assert client.patch(f"/api/cards/{card['id']}", json={"donor_name": None}).json()["donor_name"] == ""


def test_fields_not_sent_stay_the_same(client):
    card = client.post("/api/cards", json={"text": "Спеть", "donor_name": "Катя", "amount": 300}).json()
    edited = client.patch(f"/api/cards/{card['id']}", json={"text": "Спеть две"}).json()
    assert (edited["donor_name"], edited["amount"]) == ("Катя", 300)

    cleared = client.patch(f"/api/cards/{card['id']}", json={"amount": None}).json()
    assert cleared["amount"] is None and cleared["streamer_amount"] is None


def test_amount_cannot_be_negative(client):
    assert client.post("/api/cards", json={"text": "Спеть", "amount": -5}).status_code == 422


def test_donor_suggestions(client):
    donate(1, username="Вася")
    donate(2, username="вася")
    donate(3, username="Катя_стрим")
    donate(4, username="")
    client.post("/api/cards", json={"text": "Спеть", "donor_name": "Кот"})

    # Свежие выше; «Вася» и «вася» — один ник, аноним без ника не попадает
    assert client.get("/api/donors").json() == ["Кот", "Катя_стрим", "вася"]
    # Сначала те, что начинаются с букв, потом те, где буквы в середине
    assert client.get("/api/donors", params={"q": "ка"}).json() == ["Катя_стрим"]
    assert client.get("/api/donors", params={"q": "т"}).json() == ["Кот", "Катя_стрим"]
    assert client.get("/api/donors", params={"q": "ВАС"}).json() == ["вася"]
