"""Страница для зрителей: доска только для чтения по секретной ссылке."""

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from app.donationalerts import listener


@pytest.fixture
def viewer(client):
    """Зритель: отдельный браузер без cookie."""
    return TestClient(client.app)


def turn_on_link(client_) -> str:
    return client_.post("/api/settings/viewer/link").json()["public_token"]


def test_link_is_off_by_default(client):
    assert client.get("/api/settings/viewer").json() == {"public_token": None, "donation_url": ""}


def test_viewer_sees_board_without_login(client, viewer):
    client.post("/api/cards", json={"donor_name": "Вася", "text": "Спой песню", "amount": 300})
    token = turn_on_link(client)

    board = viewer.get(f"/api/public/boards/{token}").json()

    assert [card["title"] for card in board["cards"]] == ["Спой песню"]
    card = board["cards"][0]
    assert (card["donor_name"], card["amount"]) == ("Вася", 300)
    # Служебных полей у зрителя нет
    assert "archive_note" not in card and "source" not in card
    assert [column["kind"] for column in board["columns"]] == ["incoming", "work", "done"]
    assert board["intake_open"] is True
    assert board["donation_url"] == ""
    assert board["streamer_name"] is None  # гость без DonationAlerts
    assert board["donations_connected"] is False
    # Зрителю не создали гостя: cookie сессии у него нет
    assert "session" not in viewer.cookies


def test_wrong_or_turned_off_link_does_not_work(client, viewer):
    assert viewer.get("/api/public/boards/wrong").status_code == 404

    old_token = turn_on_link(client)
    new_token = turn_on_link(client)  # «Сделать новую ссылку»
    assert viewer.get(f"/api/public/boards/{old_token}").status_code == 404
    assert viewer.get(f"/api/public/boards/{new_token}").status_code == 200

    client.delete("/api/settings/viewer/link")
    assert viewer.get(f"/api/public/boards/{new_token}").status_code == 404


def test_viewer_sees_only_board_of_the_link(client, viewer):
    other = TestClient(client.app)
    other.post("/api/cards", json={"text": "Чужая"})
    client.post("/api/cards", json={"text": "Моя"})
    token = turn_on_link(client)

    assert [card["title"] for card in viewer.get(f"/api/public/boards/{token}").json()["cards"]] == ["Моя"]


@pytest.mark.parametrize(
    "url",
    [
        "http://www.donationalerts.com/r/streamer",  # без https
        "https://evil.example/r/streamer",
        "https://donationalerts.com.evil.example/r/streamer",
        "javascript:alert(1)",
    ],
)
def test_only_donationalerts_link_is_accepted(client, url):
    response = client.put("/api/settings/viewer/donation-url", json={"url": url})
    assert response.status_code == 400


def test_donation_url_is_shown_to_viewers(client, viewer):
    token = turn_on_link(client)
    url = "https://www.donationalerts.com/r/streamer"

    client.put("/api/settings/viewer/donation-url", json={"url": f"  {url} "})
    assert viewer.get(f"/api/public/boards/{token}").json()["donation_url"] == url

    # Пустая ссылка убирает кнопку «+»
    client.put("/api/settings/viewer/donation-url", json={"url": ""})
    assert viewer.get(f"/api/public/boards/{token}").json()["donation_url"] == ""


def test_viewer_gets_live_updates(client, viewer):
    token = turn_on_link(client)
    with viewer.websocket_connect(f"/api/public/boards/{token}/ws") as websocket:
        client.post("/api/cards", json={"text": "Новая"})
        assert websocket.receive_json() == {"type": "board_changed"}


def test_live_updates_need_a_working_link(viewer):
    with pytest.raises(WebSocketDisconnect) as error:
        with viewer.websocket_connect("/api/public/boards/wrong/ws") as websocket:
            websocket.receive_json()
    assert error.value.code == 1008


def test_viewer_knows_if_donations_reach_the_board(client, viewer, fake_da, monkeypatch):
    async def fake_restart(user_id):
        pass

    monkeypatch.setattr(listener.donation_listeners, "restart", fake_restart)
    token = turn_on_link(client)
    login = client.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    client.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)

    assert viewer.get(f"/api/public/boards/{token}").json()["donations_connected"] is True

    # Выход на устройстве подключение не трогает: донаты по-прежнему становятся карточками
    client.post("/api/me/logout")
    assert viewer.get(f"/api/public/boards/{token}").json()["donations_connected"] is True


def test_no_donations_without_donationalerts_connection(client, viewer):
    token = turn_on_link(client)
    user_id = client.get("/api/me").json()["id"]
    listener.save_connection(user_id, {"access_token": "access-1", "refresh_token": None})
    assert viewer.get(f"/api/public/boards/{token}").json()["donations_connected"] is True

    # «Отключить» DonationAlerts: донаты больше не станут карточками
    client.post("/api/auth/logout")
    assert viewer.get(f"/api/public/boards/{token}").json()["donations_connected"] is False
