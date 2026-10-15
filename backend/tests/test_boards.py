"""У каждого пользователя своя доска: чужие карточки, колонки и настройки не видны и не меняются."""

import asyncio
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.db import connect, init_db
from app.donationalerts import listener


@pytest.fixture
def other(client):
    """Второй браузер: у него своя cookie, значит, свой гость и своя доска."""
    return TestClient(client.app)


@pytest.fixture
def no_listener(monkeypatch):
    async def fake_restart():
        pass

    monkeypatch.setattr(listener.donation_listener, "restart", fake_restart)


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

    data = {"id": 900, "username": "Вася", "message": "Живой донат", "amount": 100, "currency": "RUB"}
    asyncio.run(listener.save_donation(data))

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Живой донат"]
    assert other.get("/api/cards").json() == []

    # Чужое подключение другой пользователь не видит и отключить не может
    assert client.get("/api/auth/status").json()["connected"] is True
    assert other.get("/api/auth/status").json()["connected"] is False
    assert other.post("/api/auth/logout").status_code == 403


def make_board_old(card_title: str) -> None:
    """
    Превращает базу с одной доской в «старую»: у колонок и карточек нет доски,
    настройки лежат в общей таблице settings. Кладёт в «Очередь» карточку card_title.
    """
    with connect() as db:
        db.execute("UPDATE board_columns SET board_id = NULL")
        db.execute("UPDATE cards SET board_id = NULL")
        db.execute("DELETE FROM board_settings")
        db.execute("DELETE FROM boards")
        db.execute("INSERT INTO settings (key, value) VALUES ('auto_merge', '1')")
        db.execute(
            """
            INSERT INTO cards (title, column_id, created_at, updated_at, moved_at)
            VALUES (?, (SELECT id FROM board_columns WHERE kind = 'incoming'), '1', '1', '1')
            """,
            (card_title,),
        )


def test_old_board_goes_to_user_with_donationalerts(client, other, fake_da, no_listener):
    other.get("/api/me")
    connect_donationalerts(client)
    client.get("/api/columns")  # единственная доска в базе
    make_board_old("Старая карточка")

    init_db()
    init_db()  # второй запуск ничего не портит

    assert [card["title"] for card in client.get("/api/cards").json()] == ["Старая карточка"]
    assert client.get("/api/settings/auto-merge").json() == {"enabled": True}
    # У второго пользователя — новая пустая доска с настройками по умолчанию
    assert other.get("/api/cards").json() == []
    assert other.get("/api/settings/auto-merge").json() == {"enabled": False}


def test_old_board_without_users_goes_to_first_visitor(client, other):
    client.get("/api/columns")  # единственная доска в базе
    make_board_old("Старая карточка")
    with connect() as db:
        db.execute("DELETE FROM sessions")
        db.execute("DELETE FROM users")

    init_db()

    # Пользователей в базе не было: доску забирает тот, кто первым откроет сайт
    assert [card["title"] for card in other.get("/api/cards").json()] == ["Старая карточка"]
    assert client.get("/api/cards").json() == []


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
        assert db.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1

