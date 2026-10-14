"""Фильтр и поиск в истории."""

from tests.test_merging import donate


def titles(response):
    return sorted(card["title"] for card in response.json())


def make_history(client):
    """Три карточки в истории: выполненная, удалённая и донат от Васи (удалённый)."""
    incoming = next(c["id"] for c in client.get("/api/columns").json() if c["kind"] == "incoming")
    done = client.post("/api/cards", json={"title": "Спеть песню", "description": "", "column_id": incoming}).json()
    deleted = client.post("/api/cards", json={"title": "Сыграть катку", "description": "на пистолетах", "column_id": incoming}).json()
    client.post(f"/api/cards/{done['id']}/archive", json={"reason": "done"})
    client.delete(f"/api/cards/{deleted['id']}")
    donate("Вася", 100, "Привет")
    donation = next(card for card in client.get("/api/cards").json() if card["donor_name"] == "Вася")
    client.delete(f"/api/cards/{donation['id']}")


def test_history_filter_by_reason(client):
    make_history(client)

    assert titles(client.get("/api/history", params={"reason": "done"})) == ["Спеть песню"]
    assert titles(client.get("/api/history", params={"reason": "deleted"})) == ["Привет", "Сыграть катку"]
    assert len(client.get("/api/history").json()) == 3


def test_history_search_ignores_case_and_looks_everywhere(client):
    make_history(client)

    # По нику, без учёта регистра русских букв
    assert titles(client.get("/api/history", params={"q": "вася"})) == ["Привет"]
    # По тексту карточки
    assert titles(client.get("/api/history", params={"q": "ПИСТОЛЕТ"})) == ["Сыграть катку"]
    # Поиск и фильтр вместе
    assert titles(client.get("/api/history", params={"q": "катку", "reason": "done"})) == []


def test_history_rejects_unknown_reason(client):
    assert client.get("/api/history", params={"reason": "lost"}).status_code == 422
