import json
import os

import httpx2
import pytest

from app import config
from app.db import connect
from app.donationalerts import client as da_client

from .helpers import BoardClient

# Тесты работают с отдельной базой, чтобы не трогать настоящую. В docker-compose.yml
# она создаётся рядом с основной. Другой адрес можно задать переменной TEST_DATABASE_URL.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://donation_kanban:donation_kanban@localhost:5432/donation_kanban_test"
)


@pytest.fixture(autouse=True)
def empty_database(monkeypatch):
    """
    Перед каждым тестом база пустая: таблицы на месте (их создают миграции),
    а строк в них нет. TRUNCATE быстро очищает таблицы, RESTART IDENTITY
    начинает id заново с 1.
    """
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    from app.db import init_db

    init_db()
    with connect() as db:
        tables = [
            row["tablename"]
            for row in db.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations'"
            )
        ]
        db.execute(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE")


@pytest.fixture
def client():
    """Клиент для запросов к API. Каждый тест начинает с пустой базой (см. empty_database)."""
    from app.main import app

    with BoardClient(app) as test_client:
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
