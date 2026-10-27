"""Запросы с чужих сайтов не могут ничего поменять (см. app/origin_check.py)."""

from app import config


def test_change_from_our_site_is_allowed(client):
    response = client.post("/api/columns", json={"title": "Песни"}, headers={"Origin": config.FRONTEND_URL})
    assert response.status_code == 201


def test_change_from_other_site_is_rejected(client):
    response = client.post("/api/columns", json={"title": "Песни"}, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_reading_from_other_site_is_not_blocked(client):
    # Чтение ничего не меняет. От чтения чужим сайтом защищает сам браузер: ответ он ему не отдаст
    response = client.get("/api/me", headers={"Origin": "https://evil.example"})
    assert response.status_code == 200


def test_request_without_origin_is_allowed(client):
    # Так ходят curl и тесты: cookie входа браузера у них нет
    response = client.post("/api/columns", json={"title": "Песни"})
    assert response.status_code == 201


def test_localhost_is_allowed_locally(client, monkeypatch):
    monkeypatch.setattr(config, "FRONTEND_URL", "http://127.0.0.1:5173")
    monkeypatch.setattr(config, "IS_PRODUCTION", False)
    response = client.post("/api/columns", json={"title": "Песни"}, headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 201


def test_only_real_domain_is_allowed_on_server(client, monkeypatch):
    monkeypatch.setattr(config, "FRONTEND_URL", "https://donationdeck.ru")
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    ok = client.post("/api/columns", json={"title": "Песни"}, headers={"Origin": "https://donationdeck.ru"})
    other = client.post("/api/columns", json={"title": "Песни"}, headers={"Origin": "http://localhost:5173"})
    assert (ok.status_code, other.status_code) == (201, 403)
