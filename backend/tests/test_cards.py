from app.db import connect
from app.donations import Donation, add_donation_card

from .helpers import default_board_id


def columns(client):
    """Колонки доски: вид колонки → её id. Промежуточная по умолчанию одна."""
    return {column["kind"]: column["id"] for column in client.get("/api/columns").json()}


def create(client, title, column_id=None):
    response = client.post("/api/cards", json={"text": title, "column_id": column_id})
    assert response.status_code == 201
    return response.json()


def move(client, card, column_id):
    response = client.post(f"/api/cards/{card['id']}/move", json={"column_id": column_id})
    assert response.status_code == 200
    return response.json()


def column(client, column_id):
    """Заголовки карточек в колонке сверху вниз — в том порядке, в каком их отдаёт API."""
    cards = client.get("/api/cards").json()
    return [card["title"] for card in cards if card["column_id"] == column_id]


def donate(username, amount, message, donation_id, streamer_amount=None):
    donation = Donation(
        id=donation_id,
        username=username,
        message=message,
        amount=amount,
        currency="RUB",
        streamer_amount=amount if streamer_amount is None else streamer_amount,
    )
    with connect() as db:
        add_donation_card(db, default_board_id(db), donation)


def test_default_columns(client):
    titles = [(column["title"], column["kind"]) for column in client.get("/api/columns").json()]
    assert titles == [("Очередь", "incoming"), ("В работе", "work"), ("Выполнено", "done")]


def test_create_goes_to_incoming_by_default(client):
    card = create(client, "Спеть песню")
    assert card["column_id"] == columns(client)["incoming"]
    assert card["source"] == "manual"
    assert column(client, columns(client)["incoming"]) == ["Спеть песню"]


def test_update(client):
    card = create(client, "Старое")
    response = client.patch(f"/api/cards/{card['id']}", json={"text": "Новое"})
    assert response.json()["title"] == "Новое"
    assert response.json()["description"] == ""


def test_bigger_donation_is_higher(client):
    donate("Вася", 200, "Старый на 200", donation_id=1)
    donate("Петя", 50, "Мелкий", donation_id=2)
    donate("Катя", 500, "Свежий на 500", donation_id=3)
    create(client, "Ручная карточка")

    incoming = columns(client)["incoming"]
    assert column(client, incoming) == ["Свежий на 500", "Старый на 200", "Мелкий", "Ручная карточка"]


def test_same_amount_older_is_higher(client):
    donate("Вася", 100, "Первый", donation_id=1)
    donate("Петя", 100, "Второй", donation_id=2)
    assert column(client, columns(client)["incoming"]) == ["Первый", "Второй"]


def test_sorting_uses_streamer_currency(client):
    # 5 долларов дороже 200 рублей, хотя число меньше
    donate("Вася", 200, "200 рублей", donation_id=1)
    donate("John", 5, "5 долларов", donation_id=2, streamer_amount=450)
    assert column(client, columns(client)["incoming"]) == ["5 долларов", "200 рублей"]


def test_move_to_any_column(client):
    ids = columns(client)
    card = create(client, "A")

    # Из «Очереди» сразу в «Выполнено», минуя «В работе»
    move(client, card, ids["done"])
    assert column(client, ids["done"]) == ["A"]

    # И обратно в «Очередь»
    move(client, card, ids["incoming"])
    assert column(client, ids["incoming"]) == ["A"]
    assert column(client, ids["done"]) == []


def test_move_to_unknown_column_returns_404(client):
    card = create(client, "A")
    response = client.post(f"/api/cards/{card['id']}/move", json={"column_id": 999})
    assert response.status_code == 404


def test_done_column_shows_last_done_first(client):
    ids = columns(client)
    first = create(client, "Сделали первой")
    second = create(client, "Сделали второй")
    move(client, first, ids["done"])
    move(client, second, ids["done"])
    assert column(client, ids["done"]) == ["Сделали второй", "Сделали первой"]


def test_clear_done_moves_cards_to_history(client):
    ids = columns(client)
    move(client, create(client, "A"), ids["done"])
    move(client, create(client, "B"), ids["done"])
    create(client, "Осталась в куче")

    assert client.post("/api/cards/clear-done").json() == {"cleared": 2}

    assert column(client, ids["done"]) == []
    assert column(client, ids["incoming"]) == ["Осталась в куче"]
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {"A": "done", "B": "done"}


def test_clear_queue_deletes_only_queue_cards(client):
    ids = columns(client)
    create(client, "A")
    create(client, "B")
    move(client, create(client, "В работе"), ids["work"])

    assert client.post("/api/cards/clear-queue").json() == {"cleared": 2}

    assert column(client, ids["incoming"]) == []
    assert column(client, ids["work"]) == ["В работе"]
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {"A": "deleted", "B": "deleted"}


def test_remove_moves_card_to_history(client):
    ids = columns(client)
    card = create(client, "A")
    done = move(client, create(client, "Готово"), ids["done"])

    client.delete(f"/api/cards/{card['id']}")
    client.delete(f"/api/cards/{done['id']}")

    assert client.get("/api/cards").json() == []
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {"A": "deleted", "Готово": "done"}


def test_restore_returns_card_to_incoming(client):
    ids = columns(client)
    card = create(client, "A", column_id=ids["work"])
    client.delete(f"/api/cards/{card['id']}")

    restored = client.post(f"/api/history/{card['id']}/restore").json()
    assert restored["column_id"] == ids["incoming"]
    assert restored["archived_at"] is None
    assert client.get("/api/history").json() == []


def test_delete_forever(client):
    card = create(client, "A")
    client.delete(f"/api/cards/{card['id']}")
    assert client.delete(f"/api/history/{card['id']}").status_code == 204
    assert client.get("/api/history").json() == []


def test_unknown_card_returns_404(client):
    assert client.patch("/api/cards/999", json={"text": "x"}).status_code == 404
    assert client.post("/api/history/999/restore").status_code == 404


def test_restore_to_chosen_column(client):
    """Кнопка «Отменить» возвращает карточку туда, где она была."""
    ids = columns(client)
    card = create(client, "A", column_id=ids["work"])
    client.delete(f"/api/cards/{card['id']}")

    response = client.post(f"/api/history/{card['id']}/restore", json={"column_id": ids["work"]})
    assert response.json()["column_id"] == ids["work"]


def test_archive_with_chosen_reason(client):
    """Зоны по краям доски: из любой колонки сразу в историю с нужной пометкой."""
    ids = columns(client)
    done = create(client, "Сделано из кучи")
    deleted = create(client, "Выкинуто из работы", column_id=ids["work"])

    client.post(f"/api/cards/{done['id']}/archive", json={"reason": "done"})
    client.post(f"/api/cards/{deleted['id']}/archive", json={"reason": "deleted"})

    assert client.get("/api/cards").json() == []
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {
        "Сделано из кучи": "done",
        "Выкинуто из работы": "deleted",
    }


def test_archive_with_unknown_reason_is_rejected(client):
    card = create(client, "A")
    response = client.post(f"/api/cards/{card['id']}/archive", json={"reason": "lost"})
    assert response.status_code == 422
