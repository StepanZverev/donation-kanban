def create(client, title, status="queue"):
    response = client.post("/api/cards", json={"title": title, "status": status})
    assert response.status_code == 201
    return response.json()


def column(client, status):
    """Заголовки карточек в колонке сверху вниз."""
    cards = client.get("/api/cards").json()
    in_column = [card for card in cards if card["status"] == status]
    return [card["title"] for card in sorted(in_column, key=lambda card: card["position"])]


def test_create_and_list(client):
    card = create(client, "Спеть песню")
    assert card["status"] == "queue"
    assert card["source"] == "manual"
    assert card["position"] == 0
    assert column(client, "queue") == ["Спеть песню"]


def test_empty_title_is_rejected(client):
    assert client.post("/api/cards", json={"title": ""}).status_code == 422


def test_update(client):
    card = create(client, "Старое")
    response = client.patch(f"/api/cards/{card['id']}", json={"title": "Новое"})
    assert response.json()["title"] == "Новое"
    assert response.json()["description"] == ""


def test_move_between_columns_in_any_direction(client):
    a = create(client, "A")
    create(client, "B")
    create(client, "C", status="done")

    client.post(f"/api/cards/{a['id']}/move", json={"status": "done", "position": 0})
    assert column(client, "queue") == ["B"]
    assert column(client, "done") == ["A", "C"]

    # И обратно, из «Выполнено» в «В очереди»
    client.post(f"/api/cards/{a['id']}/move", json={"status": "queue", "position": 5})
    assert column(client, "queue") == ["B", "A"]
    assert column(client, "done") == ["C"]


def test_reorder_inside_column(client):
    create(client, "A")
    create(client, "B")
    c = create(client, "C")

    client.post(f"/api/cards/{c['id']}/move", json={"status": "queue", "position": 0})
    assert column(client, "queue") == ["C", "A", "B"]


def test_remove_moves_card_to_history(client):
    a = create(client, "A")
    create(client, "B")
    done = create(client, "Готово", status="done")

    client.delete(f"/api/cards/{a['id']}")
    client.delete(f"/api/cards/{done['id']}")

    assert column(client, "queue") == ["B"]
    history = client.get("/api/history").json()
    reasons = {card["title"]: card["archive_reason"] for card in history}
    assert reasons == {"A": "deleted", "Готово": "done"}


def test_restore_returns_card_to_queue(client):
    card = create(client, "A", status="in_progress")
    client.delete(f"/api/cards/{card['id']}")

    restored = client.post(f"/api/history/{card['id']}/restore").json()
    assert restored["status"] == "queue"
    assert restored["archived_at"] is None
    assert client.get("/api/history").json() == []


def test_delete_forever(client):
    card = create(client, "A")
    client.delete(f"/api/cards/{card['id']}")
    assert client.delete(f"/api/history/{card['id']}").status_code == 204
    assert client.get("/api/history").json() == []


def test_unknown_card_returns_404(client):
    assert client.patch("/api/cards/999", json={"title": "x"}).status_code == 404
    assert client.post("/api/history/999/restore").status_code == 404
