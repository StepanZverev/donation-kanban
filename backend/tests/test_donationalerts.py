import asyncio
import json
from urllib.parse import parse_qs, urlparse

import httpx2
from websockets.asyncio.server import serve

from app import config
from app.db import open_db
from app.donationalerts import listener


def fake_donation(donation_id: int, message: str = "Привет") -> dict:
    return {
        "id": donation_id,
        "name": "donation",
        "username": "Вася",
        "message_type": "text",
        "message": message,
        "amount": 100,
        "currency": "RUB",
        "is_shown": 0,
        "created_at": "2026-10-12 12:00:00",
        "shown_at": None,
    }


def queue_titles(client_):
    # Суммы у тестовых донатов одинаковые, поэтому в «Очереди» они идут от старых к новым
    return [card["title"] for card in client_.get("/api/cards").json()]


def test_extract_donation():
    message = {"result": {"channel": "$alerts:donation_1", "data": {"seq": 5, "data": fake_donation(7)}}}
    assert listener.extract_donation(message)["id"] == 7

    subscribe_reply = {"id": 2, "result": {}}
    assert listener.extract_donation(subscribe_reply) is None


def test_status_without_keys(client):
    body = client.get("/api/auth/status").json()
    assert body == {"configured": False, "connected": False, "listener": "not_configured"}


def test_login_and_callback(client, fake_da, monkeypatch):
    # Старые донаты, которые были до подключения, в очередь попасть не должны
    fake_da.extend([fake_donation(5), fake_donation(4)])

    async def fake_restart(user_id):
        pass

    monkeypatch.setattr(listener.donation_listeners, "restart", fake_restart)

    login = client.get("/api/auth/login", follow_redirects=False)
    assert login.status_code == 307
    authorize_url = urlparse(login.headers["location"])
    assert authorize_url.netloc == "www.donationalerts.com"
    state = parse_qs(authorize_url.query)["state"][0]

    callback = client.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)
    assert callback.status_code == 307
    assert callback.headers["location"] == config.FRONTEND_URL

    connection = listener.read_connection(client.get("/api/me").json()["id"])
    assert (connection["access_token"], connection["last_donation_id"]) == ("access-1", 5)
    assert client.get("/api/auth/status").json()["connected"] is True
    assert queue_titles(client) == []


def test_callback_with_wrong_state_is_rejected(client, fake_da):
    client.get("/api/auth/login", follow_redirects=False)
    assert client.get("/api/auth/callback?code=abc&state=wrong").status_code == 400


def test_refused_login_returns_to_site(client, fake_da):
    """На странице DonationAlerts нажали «Отказаться»: просто возвращаемся на сайт."""
    client.get("/api/auth/login", follow_redirects=False)
    callback = client.get("/api/auth/callback?error=access_denied", follow_redirects=False)
    assert (callback.status_code, callback.headers["location"]) == (307, config.FRONTEND_URL)
    assert client.get("/api/auth/status").json()["connected"] is False


def test_login_returns_to_site_if_donationalerts_fails(client, fake_da, monkeypatch):
    async def broken_exchange(code):
        raise httpx2.ConnectError("DonationAlerts не отвечает")

    monkeypatch.setattr("app.donationalerts.client.exchange_code", broken_exchange)
    login = client.get("/api/auth/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    callback = client.get(f"/api/auth/callback?code=abc&state={state}", follow_redirects=False)
    assert (callback.status_code, callback.headers["location"]) == (307, config.FRONTEND_URL)
    assert client.get("/api/auth/status").json()["connected"] is False


def add_connection(client_, last_donation_id: int) -> int:
    """Подключение DA для пользователя тестового клиента, как будто он уже входил. Возвращает его id."""
    user_id = client_.get("/api/me").json()["id"]
    listener.save_connection(user_id, {"access_token": "access-1", "refresh_token": "refresh-1"})
    with open_db() as db:
        db.execute("UPDATE da_connections SET last_donation_id = %s", (last_donation_id,))
    return user_id


def test_missed_donations_are_imported_in_order(client, fake_da):
    user_id = add_connection(client, last_donation_id=10)
    # DA отдаёт сначала новые; по 3 на страницу, так что 11 и 10 — на второй
    fake_da.extend([fake_donation(i, f"Донат {i}") for i in [14, 13, 12, 11, 10, 9]])

    asyncio.run(listener.import_missed_donations(user_id, "access-1"))

    assert queue_titles(client) == ["Донат 11", "Донат 12", "Донат 13", "Донат 14"]
    assert listener.read_connection(user_id)["last_donation_id"] == 14

    # Повторная догрузка ничего не дублирует
    asyncio.run(listener.import_missed_donations(user_id, "access-1"))
    assert len(queue_titles(client)) == 4


def test_listener_turns_live_donation_into_card(client, fake_da, monkeypatch):
    """Полный путь: подключение к (поддельному) Centrifugo, подписка, донат → карточка."""
    user_id = add_connection(client, last_donation_id=0)
    received: list[dict] = []

    async def fake_centrifugo(websocket):
        connect_message = json.loads(await websocket.recv())
        received.append(connect_message)
        await websocket.send(json.dumps({"id": 1, "result": {"client": "client-uuid"}}))

        subscribe_message = json.loads(await websocket.recv())
        received.append(subscribe_message)
        # Ответ на подписку и сразу донат — в одном сообщении через перевод строки
        push = {"result": {"channel": "$alerts:donation_77", "data": {"seq": 1, "data": fake_donation(500, "Живой донат")}}}
        await websocket.send(json.dumps({"id": 2, "result": {}}) + "\n" + json.dumps(push))
        await websocket.wait_closed()

    async def scenario():
        async with serve(fake_centrifugo, "127.0.0.1", 0) as server:
            port = server.sockets[0].getsockname()[1]
            monkeypatch.setattr(listener, "CENTRIFUGO_URL", f"ws://127.0.0.1:{port}")
            donation_listener = listener.DonationListener(user_id)
            donation_listener.start()
            for _ in range(50):
                await asyncio.sleep(0.05)
                if queue_titles(client):
                    break
            status = donation_listener.status
            await donation_listener.stop()
            return status

    status = asyncio.run(scenario())

    assert status == "listening"
    assert queue_titles(client) == ["Живой донат"]
    assert received[0] == {"params": {"token": "socket-token"}, "id": 1}
    assert received[1]["params"] == {"channel": "$alerts:donation_77", "token": "channel-token"}
