from urllib.parse import parse_qs, urlparse

import pytest

from app.donationalerts import listener


@pytest.fixture
def no_listener(monkeypatch):
    """После входа в DA бэкенд перезапускает слушателя донатов. В тестах он не нужен."""

    async def fake_restart():
        pass

    monkeypatch.setattr(listener.donation_listener, "restart", fake_restart)


def connect_donationalerts(client_):
    """Проходит вход через (поддельный) DonationAlerts так же, как браузер."""
    login = client_.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    return client_.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)


def test_first_visit_creates_guest_and_remembers_it(client):
    first = client.get("/api/me").json()
    assert first["is_guest"] is True
    assert first["logins"] == []

    # Браузер прислал ту же cookie — тот же пользователь
    assert client.get("/api/me").json()["id"] == first["id"]


def test_unknown_session_gets_new_guest(client):
    first_id = client.get("/api/me").json()["id"]
    client.cookies.set("session", "made-up-token")
    assert client.get("/api/me").json()["id"] != first_id


def test_connecting_donationalerts_turns_guest_into_user(client, fake_da, no_listener):
    guest_id = client.get("/api/me").json()["id"]

    assert connect_donationalerts(client).status_code == 307

    me = client.get("/api/me").json()
    assert me["id"] == guest_id
    assert me["is_guest"] is False
    assert me["logins"] == ["donationalerts"]
    assert me["name"] == "Стример"
    assert me["avatar_url"] == "https://example.com/a.png"


def test_donationalerts_login_on_another_device_opens_same_user(client, fake_da, no_listener):
    client.get("/api/me")
    connect_donationalerts(client)
    user_id = client.get("/api/me").json()["id"]

    # «Другое устройство»: браузер без cookie сначала становится новым гостем
    client.cookies.clear()
    assert client.get("/api/me").json()["id"] != user_id

    # Вошёл тем же аккаунтом DA — попал в своего пользователя
    connect_donationalerts(client)
    assert client.get("/api/me").json()["id"] == user_id


def test_state_from_another_browser_is_rejected(client, fake_da, no_listener):
    login = client.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]

    # Другой браузер не знает cookie со state, даже если подсмотрел сам state
    client.cookies.clear()
    assert client.get(f"/api/auth/callback?code=abc&state={state}").status_code == 400


def test_logout(client, fake_da, no_listener):
    client.get("/api/me")
    # Гостю выйти нельзя: вернуться в свою доску ему будет нечем
    assert client.post("/api/me/logout").status_code == 400

    connect_donationalerts(client)
    user_id = client.get("/api/me").json()["id"]
    assert client.post("/api/me/logout").status_code == 200

    # После выхода — снова гость
    me = client.get("/api/me").json()
    assert me["id"] != user_id
    assert me["is_guest"] is True
