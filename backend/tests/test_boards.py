"""У каждого пользователя своя доска: чужие карточки, колонки и настройки не видны и не меняются."""

import asyncio
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import WebSocketDisconnect

from app.db import connect
from app.donationalerts import listener
from app.realtime import BoardUpdates, board_updates

from .helpers import BoardClient


@pytest.fixture
def other(client):
    """Второй браузер: у него своя cookie, значит, свой гость и своя доска."""
    return BoardClient(client.app)


@pytest.fixture
def no_listener(monkeypatch):
    async def fake_restart(user_id):
        pass

    monkeypatch.setattr(listener.donation_listeners, "restart", fake_restart)


def test_each_browser_gets_its_own_board(client, other):
    client.post("/api/cards", json={"text": "Моя задача"})

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Моя задача"]
    assert other.get("/api/cards").json() == []
    # Колонки у каждого свои, с теми же названиями
    my_columns = client.get("/api/columns").json()
    other_columns = other.get("/api/columns").json()
    assert [column["title"] for column in other_columns] == ["Очередь", "В работе", "Выполнено"]
    assert {column["id"] for column in my_columns}.isdisjoint(column["id"] for column in other_columns)


def test_other_board_cards_cannot_be_changed(client, other):
    card_id = client.post("/api/cards", json={"text": "Моя задача", "donor_name": "Вася"}).json()["id"]
    other_card_id = other.post("/api/cards", json={"text": "Чужая", "donor_name": "Вася"}).json()["id"]
    other_column_id = other.get("/api/columns").json()[1]["id"]

    # Чужой карточки «нет»: на любое действие с ней — 404
    assert other.patch(f"/api/cards/{card_id}", json={"text": "Взлом"}).status_code == 404
    assert other.post(f"/api/cards/{card_id}/move", json={"column_id": other_column_id}).status_code == 404
    assert other.post(f"/api/cards/{card_id}/archive", json={"reason": "done"}).status_code == 404
    assert other.delete(f"/api/cards/{card_id}").status_code == 404
    assert other.post(f"/api/cards/{other_card_id}/merge", json={"card_ids": [card_id]}).status_code == 404
    # Свою карточку в чужую колонку не положить
    assert client.post(f"/api/cards/{card_id}/move", json={"column_id": other_column_id}).status_code == 404
    assert client.post("/api/cards", json={"text": "Туда", "column_id": other_column_id}).status_code == 404

    [card] = client.get("/api/cards").json()
    assert (card["title"], card["archived_at"]) == ("Моя задача", None)


def test_other_board_history_and_columns_cannot_be_changed(client, other):
    card_id = client.post("/api/cards", json={"text": "В историю"}).json()["id"]
    client.delete(f"/api/cards/{card_id}")
    work_column_id = client.get("/api/columns").json()[1]["id"]

    assert other.get("/api/history").json() == []
    assert other.post(f"/api/history/{card_id}/restore").status_code == 404
    assert other.delete(f"/api/history/{card_id}").status_code == 404
    assert other.patch(f"/api/columns/{work_column_id}", json={"title": "Взлом"}).status_code == 404
    assert other.delete(f"/api/columns/{work_column_id}").status_code == 404

    assert len(client.get("/api/history").json()) == 1
    assert client.get("/api/columns").json()[1]["title"] == "В работе"


def test_settings_and_stream_total_are_per_board(client, other):
    intake = client.get("/api/settings/intake").json()
    client.put("/api/settings/intake", json={**intake, "open": False})
    client.put("/api/settings/auto-merge", json={"enabled": True})
    client.post("/api/cards", json={"text": "С суммой", "amount": 300})

    assert other.get("/api/settings/intake").json()["open"] is True
    assert other.get("/api/settings/auto-merge").json() == {"enabled": False}
    assert other.get("/api/stream-total").json()["total"] == 0
    assert client.get("/api/stream-total").json()["total"] == 300

    # Сброс доски чистит только свою доску
    other.post("/api/board/reset")
    assert len(client.get("/api/cards").json()) == 1


def test_donor_suggestions_are_per_board(client, other):
    client.post("/api/cards", json={"text": "Привет", "donor_name": "Вася"})
    assert other.get("/api/donors", params={"q": "ва"}).json() == []


def connect_donationalerts(client_):
    login = client_.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    client_.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)


def test_donations_go_to_the_board_of_who_connected_donationalerts(client, other, fake_da, no_listener):
    other.get("/api/cards")
    connect_donationalerts(client)
    user_id = client.get("/api/me").json()["id"]

    data = {"id": 900, "username": "Вася", "message": "Живой донат", "amount": 100, "currency": "RUB"}
    asyncio.run(listener.save_donation(user_id, data))

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Живой донат"]
    assert other.get("/api/cards").json() == []

    # Подключение DA у каждого своё: другой пользователь видит «не подключён»,
    # а его «Отключить» не трогает чужое подключение
    assert client.get("/api/auth/status").json()["connected"] is True
    assert other.get("/api/auth/status").json()["connected"] is False
    other.post("/api/auth/logout")
    assert client.get("/api/auth/status").json()["connected"] is True


def test_guest_cards_move_to_account_on_login(client, fake_da, no_listener):
    connect_donationalerts(client)
    client.post("/api/cards", json={"text": "Карточка аккаунта"})
    client.post("/api/me/logout")

    # Гостем накидал карточек: одну в «В работе», одну убрал в историю
    work_column_id = client.get("/api/columns").json()[1]["id"]
    client.post("/api/cards", json={"text": "Гостевая в работе", "column_id": work_column_id})
    gone_id = client.post("/api/cards", json={"text": "Гостевая в истории"}).json()["id"]
    client.delete(f"/api/cards/{gone_id}")

    # Вошёл обратно — гостевые карточки на доске аккаунта, в колонках того же вида
    connect_donationalerts(client)
    columns = {column["id"]: column["title"] for column in client.get("/api/columns").json()}
    cards = {card["title"]: columns[card["column_id"]] for card in client.get("/api/cards").json()}
    assert cards == {"Карточка аккаунта": "Очередь", "Гостевая в работе": "В работе"}
    assert [card["title"] for card in client.get("/api/history").json()] == ["Гостевая в истории"]
    # Гость с опустевшей доской удалён: в базе остались только аккаунт и его доска
    with connect() as db:
        assert db.execute("SELECT COUNT(*) AS count FROM boards").fetchone()["count"] == 1
        assert db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"] == 1


def test_donations_of_two_streamers_do_not_mix(client, other):
    first = client.get("/api/me").json()["id"]
    second = other.get("/api/me").json()["id"]
    listener.save_connection(first, {"access_token": "first", "refresh_token": None})
    listener.save_connection(second, {"access_token": "second", "refresh_token": None})

    donation = {"username": "Вася", "amount": 100, "currency": "RUB"}
    asyncio.run(listener.save_donation(first, {**donation, "id": 10, "message": "Первому"}))
    asyncio.run(listener.save_donation(second, {**donation, "id": 3, "message": "Второму"}))

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Первому"]
    assert [card["title"] for card in other.get("/api/cards").json()] == ["Второму"]
    # «Последний донат» у каждого свой: id из DA у разных стримеров между собой не связаны
    assert listener.read_connection(first)["last_donation_id"] == 10
    assert listener.read_connection(second)["last_donation_id"] == 3


def test_server_start_listens_to_everyone_connected(client, other, fake_da, monkeypatch):
    first = client.get("/api/me").json()["id"]
    second = other.get("/api/me").json()["id"]
    listener.save_connection(first, {"access_token": "first", "refresh_token": None})
    listener.save_connection(second, {"access_token": "second", "refresh_token": None})
    monkeypatch.setattr(listener.DonationListener, "start", lambda self: None)
    listeners = listener.DonationListeners()

    listeners.start_all()

    assert sorted(listeners.listeners) == sorted([first, second])
    assert listeners.status(first) == "connecting"


class FakeTab:
    """Вкладка браузера для проверки комнат: просто запоминает, что ей прислали."""

    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def accept(self) -> None:
        pass

    async def send_json(self, message: dict) -> None:
        self.messages.append(message)


def test_board_change_reaches_only_tabs_of_that_board():
    updates = BoardUpdates()
    mine, mine_on_phone, others = FakeTab(), FakeTab(), FakeTab()

    async def scenario():
        await updates.connect(mine, 1)
        await updates.connect(mine_on_phone, 1)
        await updates.connect(others, 2)
        await updates.broadcast(1, {"type": "board_changed"})
        updates.disconnect(others, 2)

    asyncio.run(scenario())

    assert mine.messages == mine_on_phone.messages == [{"type": "board_changed"}]
    assert others.messages == []
    assert updates.rooms == {1: {mine, mine_on_phone}}  # пустая комната доски 2 удалена


def test_each_browser_listens_to_its_own_board(client, other):
    client.get("/api/me")
    other.get("/api/me")
    with client.websocket_connect("/api/ws") as mine, other.websocket_connect("/api/ws"):
        # У каждого браузера своя доска, значит, и своя комната
        assert len(board_updates.rooms) == 2
        client.post("/api/cards", json={"text": "Моя"})
        assert mine.receive_json() == {"type": "board_changed"}

        user_id = client.get("/api/me").json()["id"]
        data = {"id": 1, "username": "Вася", "amount": 100, "currency": "RUB"}
        asyncio.run(listener.save_donation(user_id, data))
        assert mine.receive_json() == {"type": "board_changed"}


def test_live_updates_need_access_to_the_board(client, other):
    board_id = client.get("/api/me").json()["board_id"]
    other.get("/api/me")
    stranger_without_session = BoardClient(client.app)

    for browser in [other, stranger_without_session]:
        with pytest.raises(WebSocketDisconnect) as error:
            with browser.websocket_connect(f"/api/boards/{board_id}/ws") as websocket:
                websocket.receive_json()
        assert error.value.code == 1008
