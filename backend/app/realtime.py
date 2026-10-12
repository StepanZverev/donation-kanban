"""
Живые обновления доски через WebSocket.

WebSocket — это постоянное соединение между браузером и сервером.
В отличие от обычного запроса, сервер может сам написать в него в любой момент.
Мы этим пользуемся: когда на доске что-то меняется (пришёл донат, модератор
передвинул карточку), сервер шлёт всем открытым вкладкам сообщение
{"type": "board_changed"}, и они заново загружают карточки.
"""

import sqlite3

import anyio.from_thread
from fastapi import WebSocket


class BoardUpdates:
    """Хранит все открытые соединения и умеет разослать сообщение всем сразу."""

    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        # list(...) — копия, чтобы можно было удалять из set прямо в цикле
        for websocket in list(self.connections):
            try:
                await websocket.send_json(message)
            except Exception:
                # Вкладку закрыли, а соединение ещё не успело удалиться
                self.disconnect(websocket)


board_updates = BoardUpdates()


def notify_board_changed(db: sqlite3.Connection) -> None:
    """
    Сохраняет изменения в базе и сообщает всем вкладкам, что доска изменилась.

    Вызывается в конце эндпоинтов, которые что-то меняют. commit() нужен здесь,
    а не только в get_db: иначе вкладки могут перечитать карточки раньше,
    чем изменения запишутся в базу.
    """
    db.commit()
    # Эндпоинты у нас обычные (не async) функции, FastAPI запускает их в отдельном
    # потоке. from_thread.run позволяет из такого потока вызвать async-функцию.
    anyio.from_thread.run(board_updates.broadcast, {"type": "board_changed"})
