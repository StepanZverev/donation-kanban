import sqlite3

from app.db import connect, init_db
from app.donations import Donation, add_donation_card


def columns(client):
    """Колонки доски: вид колонки → её id. Промежуточная по умолчанию одна."""
    return {column["kind"]: column["id"] for column in client.get("/api/columns").json()}


def create(client, title, column_id=None):
    response = client.post("/api/cards", json={"title": title, "column_id": column_id})
    assert response.status_code == 201
    return response.json()


def move(client, card, column_id):
    response = client.post(f"/api/cards/{card['id']}/move", json={"column_id": column_id})
    assert response.status_code == 200
    return response.json()


def column(client, column_id):
    """Заголовки карточек в колонке сверху вниз — в том порядке, в каком их отдаёт API."""
    cards = client.get("/api/cards").json()
    return [card["title"] for card in cards if card["column_id"] == column_id]


def donate(username, amount, message, donation_id, streamer_amount=None):
    donation = Donation(
        id=donation_id,
        username=username,
        message=message,
        amount=amount,
        currency="RUB",
        streamer_amount=amount if streamer_amount is None else streamer_amount,
    )
    with connect() as db:
        add_donation_card(db, donation)


def test_default_columns(client):
    titles = [(column["title"], column["kind"]) for column in client.get("/api/columns").json()]
    assert titles == [("Куча", "incoming"), ("В работе", "work"), ("Выполнено", "done")]


def test_create_goes_to_incoming_by_default(client):
    card = create(client, "Спеть песню")
    assert card["column_id"] == columns(client)["incoming"]
    assert card["source"] == "manual"
    assert column(client, columns(client)["incoming"]) == ["Спеть песню"]


def test_empty_title_is_rejected(client):
    assert client.post("/api/cards", json={"title": ""}).status_code == 422


def test_update(client):
    card = create(client, "Старое")
    response = client.patch(f"/api/cards/{card['id']}", json={"title": "Новое"})
    assert response.json()["title"] == "Новое"
    assert response.json()["description"] == ""


def test_bigger_donation_is_higher(client):
    donate("Вася", 200, "Старый на 200", donation_id=1)
    donate("Петя", 50, "Мелкий", donation_id=2)
    donate("Катя", 500, "Свежий на 500", donation_id=3)
    create(client, "Ручная карточка")

    incoming = columns(client)["incoming"]
    assert column(client, incoming) == ["Свежий на 500", "Старый на 200", "Мелкий", "Ручная карточка"]


def test_same_amount_older_is_higher(client):
    donate("Вася", 100, "Первый", donation_id=1)
    donate("Петя", 100, "Второй", donation_id=2)
    assert column(client, columns(client)["incoming"]) == ["Первый", "Второй"]


def test_sorting_uses_streamer_currency(client):
    # 5 долларов дороже 200 рублей, хотя число меньше
    donate("Вася", 200, "200 рублей", donation_id=1)
    donate("John", 5, "5 долларов", donation_id=2, streamer_amount=450)
    assert column(client, columns(client)["incoming"]) == ["5 долларов", "200 рублей"]


def test_move_to_any_column(client):
    ids = columns(client)
    card = create(client, "A")

    # Из «Кучи» сразу в «Выполнено», минуя «В работе»
    move(client, card, ids["done"])
    assert column(client, ids["done"]) == ["A"]

    # И обратно в «Кучу»
    move(client, card, ids["incoming"])
    assert column(client, ids["incoming"]) == ["A"]
    assert column(client, ids["done"]) == []


def test_move_to_unknown_column_returns_404(client):
    card = create(client, "A")
    response = client.post(f"/api/cards/{card['id']}/move", json={"column_id": 999})
    assert response.status_code == 404


def test_done_column_shows_last_done_first(client):
    ids = columns(client)
    first = create(client, "Сделали первой")
    second = create(client, "Сделали второй")
    move(client, first, ids["done"])
    move(client, second, ids["done"])
    assert column(client, ids["done"]) == ["Сделали второй", "Сделали первой"]


def test_clear_done_moves_cards_to_history(client):
    ids = columns(client)
    move(client, create(client, "A"), ids["done"])
    move(client, create(client, "B"), ids["done"])
    create(client, "Осталась в куче")

    assert client.post("/api/cards/clear-done").json() == {"cleared": 2}

    assert column(client, ids["done"]) == []
    assert column(client, ids["incoming"]) == ["Осталась в куче"]
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {"A": "done", "B": "done"}


def test_remove_moves_card_to_history(client):
    ids = columns(client)
    card = create(client, "A")
    done = move(client, create(client, "Готово"), ids["done"])

    client.delete(f"/api/cards/{card['id']}")
    client.delete(f"/api/cards/{done['id']}")

    assert client.get("/api/cards").json() == []
    history = client.get("/api/history").json()
    assert {card["title"]: card["archive_reason"] for card in history} == {"A": "deleted", "Готово": "done"}


def test_restore_returns_card_to_incoming(client):
    ids = columns(client)
    card = create(client, "A", column_id=ids["work"])
    client.delete(f"/api/cards/{card['id']}")

    restored = client.post(f"/api/history/{card['id']}/restore").json()
    assert restored["column_id"] == ids["incoming"]
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


def test_old_database_is_migrated(tmp_path, monkeypatch):
    """База из прошлой версии (со status и position) переделывается без потери карточек."""
    path = tmp_path / "old.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))

    old = sqlite3.connect(path)
    old.executescript(
        """
        CREATE TABLE cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'queue',
            position INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual',
            donation_id INTEGER UNIQUE, donor_name TEXT, amount REAL, currency TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            archived_at TEXT, archive_reason TEXT
        );
        INSERT INTO cards (title, status, amount, created_at, updated_at) VALUES
            ('В очереди', 'queue', 100, '2026-01-01', '2026-01-01'),
            ('В работе', 'in_progress', NULL, '2026-01-01', '2026-01-01'),
            ('Готово', 'done', NULL, '2026-01-01', '2026-01-02');
        """
    )
    old.close()

    init_db()
    # Повторный запуск сервера ничего не ломает
    init_db()

    with connect() as db:
        rows = db.execute(
            """
            SELECT cards.title, board_columns.kind, cards.streamer_amount, cards.moved_at
            FROM cards JOIN board_columns ON board_columns.id = cards.column_id
            ORDER BY cards.id
            """
        ).fetchall()
        fields = [row["name"] for row in db.execute("PRAGMA table_info(cards)")]

    assert [tuple(row) for row in rows] == [
        ("В очереди", "incoming", 100, "2026-01-01"),
        ("В работе", "work", None, "2026-01-01"),
        ("Готово", "done", None, "2026-01-02"),
    ]
    assert "status" not in fields and "position" not in fields


def test_restore_to_chosen_column(client):
    """Кнопка «Отменить» возвращает карточку туда, где она была."""
    ids = columns(client)
    card = create(client, "A", column_id=ids["work"])
    client.delete(f"/api/cards/{card['id']}")

    response = client.post(f"/api/history/{card['id']}/restore", json={"column_id": ids["work"]})
    assert response.json()["column_id"] == ids["work"]
