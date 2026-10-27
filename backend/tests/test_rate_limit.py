"""Ограничение частоты запросов (см. app/rate_limit.py)."""

from app import rate_limit
from app.rate_limit import RateLimiter

from .helpers import BoardClient


def test_limiter_counts_within_period(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock[0])
    limiter = RateLimiter(2, 60)

    assert [limiter.allow("a"), limiter.allow("a"), limiter.allow("a")] == [True, True, False]
    # У другого адреса свой счётчик
    assert limiter.allow("b")
    # Через минуту старые запросы забываются
    clock[0] += 61
    assert limiter.allow("a")


def test_too_many_new_guests_from_one_address(monkeypatch):
    from app.main import app

    monkeypatch.setattr(rate_limit, "new_guest", RateLimiter(2, 3600))
    # Каждый новый клиент без cookie — новый гость
    statuses = []
    for _ in range(3):
        with BoardClient(app) as fresh:
            statuses.append(fresh.get("/api/me").status_code)
    assert statuses == [200, 200, 429]


def test_too_many_cards(client, monkeypatch):
    monkeypatch.setattr(rate_limit, "new_card", RateLimiter(2, 60))
    statuses = [client.post("/api/cards", json={"text": f"Заказ {i}"}).status_code for i in range(3)]
    assert statuses == [201, 201, 429]


def test_too_many_secret_link_guesses(client, monkeypatch):
    monkeypatch.setattr(rate_limit, "secret_link", RateLimiter(2, 60))
    statuses = [client.get(f"/api/public/boards/wrong-{i}").status_code for i in range(3)]
    assert statuses == [404, 404, 429]


def test_too_many_requests_at_all(client, monkeypatch):
    monkeypatch.setattr(rate_limit, "any_request", RateLimiter(3, 60))
    statuses = [client.get("/api/me").status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
