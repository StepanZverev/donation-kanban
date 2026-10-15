import json

import httpx2
import pytest
from fastapi.testclient import TestClient

from app import config
from app.donationalerts import client as da_client


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Клиент для запросов к API. Каждый тест получает свою пустую базу во временной папке."""
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def fake_da(monkeypatch):
    """Подменяет сервер DonationAlerts: запросы уходят в handle(), а не в интернет."""
    monkeypatch.setattr(config, "DA_CLIENT_ID", "test-id")
    monkeypatch.setattr(config, "DA_CLIENT_SECRET", "test-secret")
    donations: list[dict] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        if request.url.path == "/oauth/token":
            return httpx2.Response(200, json={"access_token": "access-1", "refresh_token": "refresh-1"})
        if request.url.path == "/api/v1/user/oauth":
            profile = {"id": 77, "name": "Стример", "avatar": "https://example.com/a.png", "socket_connection_token": "socket-token"}
            return httpx2.Response(200, json={"data": profile})
        if request.url.path == "/api/v1/centrifuge/subscribe":
            channel = json.loads(request.content)["channels"][0]
            return httpx2.Response(200, json={"channels": [{"channel": channel, "token": "channel-token"}]})
        if request.url.path == "/api/v1/alerts/donations":
            page = int(request.url.params.get("page", 1))
            return httpx2.Response(200, json={"data": donations[(page - 1) * 3 : page * 3]})
        return httpx2.Response(404)

    monkeypatch.setattr(da_client, "http", httpx2.AsyncClient(base_url=da_client.BASE_URL, transport=httpx2.MockTransport(handle)))
    return donations
