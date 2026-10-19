"""
Живые обновления доски через WebSocket.

WebSocket — это постоянное соединение между браузером и сервером.
В отличие от обычного запроса, сервер может сам написать в него в любой момент.
Мы этим пользуемся: когда на доске что-то меняется (пришёл донат, модератор
передвинул карточку), сервер шлёт открытым вкладкам этой доски сообщение
{"type": "board_changed"}, и они заново загружают карточки.
Вкладки других досок об этом не узнают.
"""

import anyio.from_thread
from fastapi import WebSocket, WebSocketDisconnect

from .db import Connection


class BoardUpdates:
    """
    Хранит открытые соединения, разложенные по доскам («комнатам»),
    и умеет разослать сообщение всем вкладкам одной доски.
    Так стример видит только изменения своей доски, а не всех досок на сервере.
    """

    def __init__(self) -> None:
        # id доски → открытые на ней вкладки
        self.rooms: dict[int, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, board_id: int) -> None:
        await websocket.accept()
        self.rooms.setdefault(board_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, board_id: int) -> None:
        room = self.rooms.get(board_id)
        if room is None:
            return
        room.discard(websocket)
        # Последнюю вкладку доски закрыли — пустая комната не нужна
        if not room:
            del self.rooms[board_id]

    async def broadcast(self, board_id: int, message: dict) -> None:
        # list(...) — копия, чтобы можно было удалять из комнаты прямо в цикле
        for websocket in list(self.rooms.get(board_id, ())):
            try:
                await websocket.send_json(message)
            except Exception:
                # Вкладку закрыли, а соединение ещё не успело удалиться
                self.disconnect(websocket, board_id)


board_updates = BoardUpdates()


async def send_updates_until_closed(websocket: WebSocket, board_id: int) -> None:
    """
    Подключает вкладку к комнате доски и держит соединение, пока вкладку не закроют.
    Сама вкладка ничего не присылает, цикл нужен, только чтобы соединение не закрылось.
    """
    await board_updates.connect(websocket, board_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        board_updates.disconnect(websocket, board_id)


def notify_board_changed(db: Connection, board_id: int) -> None:
    """
    Сохраняет изменения в базе и сообщает вкладкам доски board_id, что она изменилась.

    Вызывается в конце эндпоинтов, которые что-то меняют. commit() нужен здесь,
    а не только в get_db: иначе вкладки могут перечитать карточки раньше,
    чем изменения запишутся в базу.
    """
    db.commit()
    # Эндпоинты у нас обычные (не async) функции, FastAPI запускает их в отдельном
    # потоке. from_thread.run позволяет из такого потока вызвать async-функцию.
    anyio.from_thread.run(board_updates.broadcast, board_id, {"type": "board_changed"})
