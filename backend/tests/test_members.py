"""Модераторы: приглашение по ссылке, что можно модератору и что только хозяину."""

from urllib.parse import parse_qs, urlparse

import pytest

from app.donationalerts import listener

from .helpers import BoardClient


@pytest.fixture
def moderator(client):
    """Второй браузер — будущий модератор доски client."""
    return BoardClient(client.app)


@pytest.fixture
def no_listener(monkeypatch):
    async def fake_restart(user_id):
        pass

    monkeypatch.setattr(listener.donation_listeners, "restart", fake_restart)


def board_of(client_) -> int:
    return client_.get("/api/me").json()["board_id"]


def invite(owner, guest) -> int:
    """Хозяин включает приглашение, гость его принимает. Возвращает id доски хозяина."""
    token = owner.post("/api/boards/%d/invite-link" % board_of(owner)).json()["invite_token"]
    return guest.post(f"/api/invites/{token}/accept").json()["id"]


def connect_donationalerts(client_):
    login = client_.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    client_.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)


def test_stranger_does_not_see_the_board(client, moderator):
    board_id = board_of(client)
    assert moderator.get(f"/api/boards/{board_id}/cards").status_code == 404
    assert moderator.get(f"/api/boards/{board_id}").status_code == 404


def test_moderator_works_with_cards(client, moderator):
    client.post("/api/cards", json={"text": "Задача стримера"})
    board_id = invite(client, moderator)

    assert moderator.get(f"/api/boards/{board_id}").json() == {"id": board_id, "owner_name": None, "role": "moderator"}
    assert [card["title"] for card in moderator.get(f"/api/boards/{board_id}/cards").json()] == ["Задача стримера"]

    created = moderator.post(f"/api/boards/{board_id}/cards", json={"text": "От модератора"}).json()
    done_column = [column for column in moderator.get(f"/api/boards/{board_id}/columns").json() if column["kind"] == "done"][0]
    moved = moderator.post(f"/api/boards/{board_id}/cards/{created['id']}/move", json={"column_id": done_column["id"]})
    assert moved.status_code == 200

    # Хозяин видит то, что сделал модератор
    assert sorted(card["title"] for card in client.get("/api/cards").json()) == ["Задача стримера", "От модератора"]
    # А своя доска модератора осталась пустой и своей
    assert moderator.get("/api/cards").json() == []


def test_settings_are_only_for_owner(client, moderator):
    board_id = invite(client, moderator)
    base = f"/api/boards/{board_id}"

    # Читать настройки модератору можно: по ним красятся карточки
    assert moderator.get(f"{base}/settings/priority-levels").status_code == 200
    # Менять — нельзя
    forbidden = [
        moderator.put(f"{base}/settings/auto-merge", json={"enabled": True}),
        moderator.put(f"{base}/settings/intake", json={"open": False, "min_amount": 0, "ignore_anonymous": False}),
        moderator.post(f"{base}/columns", json={"title": "Новая"}),
        moderator.post(f"{base}/reset"),
        moderator.get(f"{base}/settings/viewer"),
        moderator.get(f"{base}/members"),
        moderator.post(f"{base}/invite-link"),
    ]
    assert [response.status_code for response in forbidden] == [403] * len(forbidden)


def test_moderated_boards_are_listed_in_me(client, moderator, fake_da, no_listener):
    connect_donationalerts(client)  # у хозяина появляется имя из DonationAlerts
    board_id = invite(client, moderator)

    me = moderator.get("/api/me").json()
    assert me["moderated_boards"] == [{"id": board_id, "owner_name": "Стример", "role": "moderator"}]
    assert me["board_id"] != board_id


def test_owner_sees_and_removes_moderators(client, moderator):
    board_id = invite(client, moderator)
    moderator_id = moderator.get("/api/me").json()["id"]

    members = client.get(f"/api/boards/{board_id}/members").json()
    assert [(member["user_id"], member["is_guest"]) for member in members] == [(moderator_id, True)]

    assert client.delete(f"/api/boards/{board_id}/members/{moderator_id}").status_code == 204
    assert client.get(f"/api/boards/{board_id}/members").json() == []
    assert moderator.get(f"/api/boards/{board_id}/cards").status_code == 404
    assert moderator.get("/api/me").json()["moderated_boards"] == []


def test_new_or_turned_off_invite_link_stops_old_one(client, moderator):
    board_id = board_of(client)
    old_token = client.post(f"/api/boards/{board_id}/invite-link").json()["invite_token"]
    new_token = client.post(f"/api/boards/{board_id}/invite-link").json()["invite_token"]

    assert moderator.post(f"/api/invites/{old_token}/accept").status_code == 404
    assert moderator.get(f"/api/invites/{new_token}").json() == {"board_id": board_id, "owner_name": None, "role": None}

    client.delete(f"/api/boards/{board_id}/invite-link")
    assert client.get(f"/api/boards/{board_id}/invite-link").json() == {"invite_token": None}
    assert moderator.post(f"/api/invites/{new_token}/accept").status_code == 404


def test_new_invite_link_keeps_moderators_but_deleting_it_removes_them(client, moderator):
    board_id = invite(client, moderator)

    # Новая ссылка: модератор остаётся
    client.post(f"/api/boards/{board_id}/invite-link")
    assert moderator.get(f"/api/boards/{board_id}").status_code == 200

    # Ссылку удалили: модератора больше нет, доска у него пропала
    client.delete(f"/api/boards/{board_id}/invite-link")
    assert client.get(f"/api/boards/{board_id}/members").json() == []
    assert moderator.get(f"/api/boards/{board_id}").status_code == 404
    assert moderator.get("/api/me").json()["moderated_boards"] == []


def test_owner_opening_own_invite_stays_owner(client):
    board_id = invite(client, client)
    assert client.get(f"/api/boards/{board_id}").json()["role"] == "owner"
    assert client.get(f"/api/boards/{board_id}/members").json() == []


def test_moderator_gets_live_updates(client, moderator):
    board_id = invite(client, moderator)
    with moderator.websocket_connect(f"/api/boards/{board_id}/ws") as websocket:
        client.post("/api/cards", json={"text": "Новая"})
        assert websocket.receive_json() == {"type": "board_changed"}


def test_guest_moderator_keeps_board_after_login(client, moderator, fake_da, no_listener):
    """
    Модератор-гость входит через DonationAlerts в аккаунт, который у него уже был.
    Гость удаляется, но модераторство переезжает в аккаунт.
    """
    connect_donationalerts(moderator)  # аккаунт модератора
    moderator.post("/api/me/logout")  # теперь в этом браузере новый гость
    board_id = invite(client, moderator)  # гость принял приглашение

    connect_donationalerts(moderator)  # гость входит в свой прежний аккаунт

    me = moderator.get("/api/me").json()
    assert me["is_guest"] is False
    assert [board["id"] for board in me["moderated_boards"]] == [board_id]


def test_moderator_introduces_himself_when_accepting(client, moderator):
    board_id = board_of(client)
    token = client.post(f"/api/boards/{board_id}/invite-link").json()["invite_token"]
    moderator.post(f"/api/invites/{token}/accept", json={"nickname": "  Вася с чата  "})

    [member] = client.get(f"/api/boards/{board_id}/members").json()
    assert member["nickname"] == "Вася с чата"
    assert member["is_guest"] is True


def test_moderator_without_name_has_no_nickname(client, moderator):
    board_id = board_of(client)
    token = client.post(f"/api/boards/{board_id}/invite-link").json()["invite_token"]
    moderator.post(f"/api/invites/{token}/accept", json={"nickname": "   "})

    [member] = client.get(f"/api/boards/{board_id}/members").json()
    assert member["nickname"] is None
