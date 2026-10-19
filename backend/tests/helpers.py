from fastapi.testclient import TestClient

from app.board import create_board
from app.db import Connection


def default_board_id(db: Connection) -> int:
    """
    Доска для тестовых донатов. В большинстве тестов пользователь один, и доска одна.
    Если доски ещё нет, создаём её без хозяина: первый запрос клиента заберёт её себе.
    """
    row = db.execute("SELECT id FROM boards ORDER BY id LIMIT 1").fetchone()
    return row["id"] if row else create_board(db, None)


# Короткие адреса, которыми пишут тесты, и чем они стали внутри /api/boards/<id доски>
BOARD_PATHS = {
    "/api/cards": "/cards",
    "/api/columns": "/columns",
    "/api/history": "/history",
    "/api/settings": "/settings",
    "/api/donors": "/donors",
    "/api/stream-total": "/stream-total",
    "/api/board/reset": "/reset",
    "/api/dev": "/dev",
    "/api/ws": "/ws",
}


class BoardClient(TestClient):
    """
    Тестовый браузер, который сам подставляет в адрес свою доску.

    Тест пишет коротко: client.get("/api/cards"), а запрос уходит на
    /api/boards/<id доски этого браузера>/cards. id доски узнаём из /api/me.
    Полные адреса (/api/boards/5/cards, /api/me и т. п.) не меняются.
    """

    def request(self, method, url, *args, **kwargs):
        return super().request(method, self.board_url(url), *args, **kwargs)

    def websocket_connect(self, url, *args, **kwargs):
        return super().websocket_connect(self.board_url(url), *args, **kwargs)

    def board_url(self, url: str) -> str:
        for short_path, board_path in BOARD_PATHS.items():
            rest = url[len(short_path) :]
            if url.startswith(short_path) and (rest == "" or rest[0] in "/?"):
                board_id = super().request("GET", "/api/me").json()["board_id"]
                return f"/api/boards/{board_id}{board_path}{rest}"
        return url
