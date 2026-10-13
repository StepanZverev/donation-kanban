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


def merge(client, target, *cards):
    """Сливает cards в target."""
    return client.post(f"/api/cards/{target['id']}/merge", json={"card_ids": [card["id"] for card in cards]})


def unmerge(client, target, *cards):
    """Разъединяет target: все слитые карточки или только cards."""
    card_ids = [card["id"] for card in cards] if cards else None
    return client.post(f"/api/cards/{target['id']}/unmerge", json={"card_ids": card_ids})


def history(client):
    return client.get("/api/history").json()


def test_merge_two_cards(client):
    donate("Вася", 200, "Расскажи, как ты начал стримить")
    donate("вася", 300, "И про первый стрим тоже!")
    older = card_by_message(client, "Расскажи")
    newer = card_by_message(client, "И про первый стрим")

    response = merge(client, older, newer)
    assert response.status_code == 200

    cards = board(client)
    assert len(cards) == 1
    merged = cards[0]
    assert merged["id"] == older["id"]
    assert merged["amount"] == 500
    assert merged["streamer_amount"] == 500
    assert merged["merge_count"] == 2
    assert merged["description"] == "Расскажи, как ты начал стримить\n⸻\nИ про первый стрим тоже!"
    assert [(card["archive_reason"], card["merged_into_id"]) for card in history(client)] == [("merged", older["id"])]


def test_merge_into_newer_card_from_any_column(client):
    """Колонка не важна: старую карточку из «Выполнено» можно слить в новую в «Очереди»."""
    donate("Вася", 100, "Старый")
    donate("Вася", 50, "Новый")
    old = card_by_message(client, "Старый")
    client.post(f"/api/cards/{old['id']}/move", json={"column_id": columns(client)["done"]})
    new = card_by_message(client, "Новый")

    assert merge(client, new, old).status_code == 200
    card = board(client)[0]
    assert (card["id"], card["amount"], card["column_id"]) == (new["id"], 150, columns(client)["incoming"])
    assert card["description"] == "Новый\n⸻\nСтарый"


def test_merge_all_goes_from_old_to_new(client):
    donate("Вася", 100, "Первый")
    donate("Вася", 100, "Второй")
    donate("Вася", 100, "Третий")
    second = card_by_message(client, "Второй")
    others = [card for card in board(client) if card["id"] != second["id"]]

    merge(client, second, *reversed(others))

    card = board(client)[0]
    assert card["amount"] == 300
    assert card["merge_count"] == 3
    assert card["description"] == "Второй\n⸻\nПервый\n⸻\nТретий"


def test_other_donor_and_history_are_not_merged(client):
    donate("Петя", 100, "Петин")
    donate("Вася", 100, "Васин")
    donate("Вася", 100, "Васин удалённый")
    petya = card_by_message(client, "Петин")
    vasya = card_by_message(client, "Васин")
    deleted = card_by_message(client, "Васин удалённый")
    client.post(f"/api/cards/{deleted['id']}/archive", json={"reason": "deleted"})

    assert merge(client, vasya, petya).status_code == 400
    assert merge(client, vasya, deleted).status_code == 400
    assert merge(client, vasya, vasya).status_code == 400


def test_unmerge_keeps_cards_in_target_column(client):
    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")
    donate("Вася", 400, "Третий")
    first = card_by_message(client, "Первый")
    second = card_by_message(client, "Второй")
    third = card_by_message(client, "Третий")
    client.post(f"/api/cards/{second['id']}/move", json={"column_id": columns(client)["work"]})
    merge(client, first, second, third)

    response = unmerge(client, first)
    assert response.status_code == 200
    assert {card["id"] for card in response.json()} == {second["id"], third["id"]}

    first = card_by_message(client, "Первый")
    assert (first["amount"], first["description"], first["merge_count"]) == (200, "", 1)
    # Все остаются в колонке основной карточки, даже «Второй», который до слияния был в работе
    assert card_by_message(client, "Второй")["column_id"] == columns(client)["incoming"]
    assert card_by_message(client, "Третий")["column_id"] == columns(client)["incoming"]
    assert history(client) == []
    # Разъединять больше нечего
    assert unmerge(client, first).status_code == 400


def test_undo_merge_returns_only_just_merged(client):
    """«Отменить» после объединения возвращает только то, что слили этим действием."""
    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")
    donate("Вася", 400, "Третий")
    first = card_by_message(client, "Первый")
    second = card_by_message(client, "Второй")
    third = card_by_message(client, "Третий")
    merge(client, first, second)
    merge(client, first, third)

    client.post(f"/api/cards/{third['id']}/move", json={"column_id": columns(client)["work"]})
    merge(client, first, card_by_message(client, "Третий"))

    unmerge(client, first, third)

    first = card_by_message(client, "Первый")
    assert (first["amount"], first["description"]) == (500, "Первый\n⸻\nВторой")
    # «Отменить» возвращает карточку туда, где она была до объединения
    assert card_by_message(client, "Третий")["column_id"] == columns(client)["work"]


def test_unmerge_from_history_in_any_order(client):
    """Переоткрыть из истории можно любую слитую карточку, не только последнюю."""
    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")
    donate("Вася", 400, "Третий")
    first = card_by_message(client, "Первый")
    second = card_by_message(client, "Второй")
    third = card_by_message(client, "Третий")
    merge(client, first, second, third)

    client.post(f"/api/history/{second['id']}/restore", json={"column_id": columns(client)["incoming"]})

    first = card_by_message(client, "Первый")
    assert (first["amount"], first["description"]) == (600, "Первый\n⸻\nТретий")


def test_donation_without_message_has_no_separator(client):
    """Если у одного из донатов нет текста, разделитель не ставим."""
    donate("Вася", 200, "")
    donate("Вася", 300, "Теперь с текстом")
    second = card_by_message(client, "Теперь с текстом")
    first = next(card for card in board(client) if card["id"] != second["id"])
    merge(client, first, second)
    assert board(client)[0]["description"] == "Теперь с текстом"

    unmerge(client, first)
    assert card_by_message(client, "Донат без сообщения")["description"] == ""


def test_new_donation_without_message_keeps_text(client):
    donate("Вася", 200, "Текст первого")
    donate("Вася", 300, "")
    first = card_by_message(client, "Текст первого")
    second = next(card for card in board(client) if card["amount"] == 300)
    merge(client, first, second)
    assert board(client)[0]["description"] == "Текст первого"


def test_merge_card_that_has_merged_cards(client):
    """Слили карточку, в которую до этого что-то слили, — разъединение работает по слоям."""
    donate("Вася", 100, "А")
    donate("Вася", 100, "Б")
    donate("Вася", 100, "В")
    a = card_by_message(client, "А")
    b = card_by_message(client, "Б")
    c = card_by_message(client, "В")
    merge(client, b, c)
    merge(client, a, card_by_message(client, "Б"))
    assert board(client)[0]["description"] == "А\n⸻\nБ\n⸻\nВ"

    unmerge(client, a)
    assert card_by_message(client, "А")["description"] == ""
    b = card_by_message(client, "Б")
    assert (b["amount"], b["merge_count"], b["description"]) == (200, 2, "Б\n⸻\nВ")


def test_different_currencies_use_streamer_currency(client):
    donate("John", 200, "Рубли")
    donate("John", 5, "Доллары", currency="USD", streamer_amount=450)
    merge(client, card_by_message(client, "Рубли"), card_by_message(client, "Доллары"))

    card = board(client)[0]
    assert (card["amount"], card["currency"], card["streamer_amount"]) == (650, "RUB", 650)
    assert card["description"] == "Рубли\n⸻\nДоллары"


def test_auto_merge(client):
    assert client.get("/api/settings/auto-merge").json() == {"enabled": False}
    client.put("/api/settings/auto-merge", json={"enabled": True})

    donate("Вася", 200, "Первый")
    donate("Вася", 300, "Второй")

    cards = board(client)
    assert len(cards) == 1
    assert cards[0]["amount"] == 500


def test_auto_merge_skips_done(client):
    """Новый донат не сливается в карточку из «Выполнено» — иначе затеряется."""
    client.put("/api/settings/auto-merge", json={"enabled": True})
    donate("Вася", 200, "Первый")
    first = card_by_message(client, "Первый")
    client.post(f"/api/cards/{first['id']}/move", json={"column_id": columns(client)["done"]})
    donate("Вася", 300, "Второй")
    assert len(board(client)) == 2
