"""Страница «Настройки»: промежуточные колонки и уровни приоритета."""


def titles(client):
    """Названия колонок слева направо."""
    return [column["title"] for column in client.get("/api/columns").json()]


def column_id(client, title):
    return next(column["id"] for column in client.get("/api/columns").json() if column["title"] == title)


def add_column(client, title):
    return client.post("/api/columns", json={"title": title})


# ----- Колонки -----


def test_new_column_goes_before_done(client):
    assert add_column(client, "Отложено").status_code == 201
    assert titles(client) == ["Очередь", "В работе", "Отложено", "Выполнено"]


def test_no_more_than_three_work_columns(client):
    add_column(client, "Вторая")
    add_column(client, "Третья")
    response = add_column(client, "Четвёртая")
    assert response.status_code == 400
    assert titles(client) == ["Очередь", "В работе", "Вторая", "Третья", "Выполнено"]


def test_rename_column(client):
    work = column_id(client, "В работе")
    response = client.patch(f"/api/columns/{work}", json={"title": "Делаю"})
    assert response.json()["title"] == "Делаю"
    assert titles(client) == ["Очередь", "Делаю", "Выполнено"]


def test_edge_columns_cannot_be_changed(client):
    incoming = column_id(client, "Очередь")
    done = column_id(client, "Выполнено")
    assert client.patch(f"/api/columns/{incoming}", json={"title": "X"}).status_code == 400
    assert client.delete(f"/api/columns/{done}").status_code == 400


def test_reorder_columns(client):
    add_column(client, "Отложено")
    ids = [column_id(client, "Отложено"), column_id(client, "В работе")]
    assert client.put("/api/columns/order", json={"column_ids": ids}).status_code == 200
    assert titles(client) == ["Очередь", "Отложено", "В работе", "Выполнено"]


def test_reorder_needs_all_work_columns(client):
    add_column(client, "Отложено")
    ids = [column_id(client, "Отложено")]
    assert client.put("/api/columns/order", json={"column_ids": ids}).status_code == 400


def test_delete_column_returns_cards_to_incoming(client):
    add_column(client, "Отложено")
    postponed = column_id(client, "Отложено")
    card = client.post("/api/cards", json={"text": "Потом", "column_id": postponed}).json()

    assert client.delete(f"/api/columns/{postponed}").status_code == 204

    assert titles(client) == ["Очередь", "В работе", "Выполнено"]
    cards = client.get("/api/cards").json()
    assert [(c["id"], c["column_id"]) for c in cards] == [(card["id"], column_id(client, "Очередь"))]


def test_all_work_columns_can_be_deleted(client):
    work = column_id(client, "В работе")
    assert client.delete(f"/api/columns/{work}").status_code == 204
    assert titles(client) == ["Очередь", "Выполнено"]

    # Без промежуточных колонок всё работает: можно добавить новую
    assert add_column(client, "Отложено").status_code == 201
    assert titles(client) == ["Очередь", "Отложено", "Выполнено"]


# ----- Уровни приоритета -----


def test_default_priority_levels(client):
    levels = client.get("/api/settings/priority-levels").json()
    assert [(level["min_amount"], level["name"]) for level in levels] == [
        (0, "Низкий"),
        (100, "Средний"),
        (500, "Высокий"),
        (1000, "Топ"),
    ]


def test_save_priority_levels_sorted_by_amount(client):
    new_levels = [
        {"min_amount": 1000, "name": "Огонь", "color": "#ff0000"},
        {"min_amount": 0, "name": "Обычный", "color": "#999999"},
    ]
    response = client.put("/api/settings/priority-levels", json=new_levels)
    assert response.status_code == 200

    saved = client.get("/api/settings/priority-levels").json()
    assert [level["name"] for level in saved] == ["Обычный", "Огонь"]


def test_priority_levels_need_zero(client):
    levels = [{"min_amount": 100, "name": "Средний", "color": "#d4a72c"}]
    assert client.put("/api/settings/priority-levels", json=levels).status_code == 400


def test_priority_levels_no_same_amount(client):
    levels = [
        {"min_amount": 0, "name": "А", "color": "#000000"},
        {"min_amount": 0, "name": "Б", "color": "#ffffff"},
    ]
    assert client.put("/api/settings/priority-levels", json=levels).status_code == 400


def test_priority_level_color_must_be_hex(client):
    levels = [{"min_amount": 0, "name": "А", "color": "red"}]
    assert client.put("/api/settings/priority-levels", json=levels).status_code == 422
