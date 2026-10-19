"""
Живые обновления доски через WebSocket.

WebSocket — это постоянное соединение между браузером и сервером.
В отличие от обычного запроса, сервер может сам написать в него в любой момент.
Мы этим пользуемся: когда на доске что-то меняется (пришёл донат, модератор
передвинул карточку), сервер шлёт открытым вкладкам этой доски сообщение
{"type": "board_changed"}, и они заново загружают карточки.
Вкладки других досок об этом не узнают.

Ещё по соединениям видно, «на месте» ли стример: пока у хозяина открыта его доска,
у него есть соединение в комнате. Это показываем зрителям («Стример на месте»).
"""

import anyio
import anyio.from_thread
import anyio.to_thread
from fastapi import WebSocket, WebSocketDisconnect

from .db import Connection, now, open_db


class BoardUpdates:
    """
    Хранит открытые соединения, разложенные по доскам («комнатам»),
    и умеет разослать сообщение всем вкладкам одной доски.
    Так стример видит только изменения своей доски, а не всех досок на сервере.
    """

    def __init__(self) -> None:
        # id доски → открытые на ней вкладки
        self.rooms: dict[int, set[WebSocket]] = {}
        # Чья это вкладка: соединение → id пользователя. У зрителей пользователя нет,
        # их соединений здесь не бывает.
        self.users: dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, board_id: int, user_id: int | None = None) -> None:
        await websocket.accept()
        self.rooms.setdefault(board_id, set()).add(websocket)
        if user_id is not None:
            self.users[websocket] = user_id

    def disconnect(self, websocket: WebSocket, board_id: int) -> None:
        self.users.pop(websocket, None)
        room = self.rooms.get(board_id)
        if room is None:
            return
        room.discard(websocket)
        # Последнюю вкладку доски закрыли — пустая комната не нужна
        if not room:
            del self.rooms[board_id]

    def is_user_connected(self, board_id: int, user_id: int) -> bool:
        """Открыта ли у пользователя user_id эта доска хотя бы в одной вкладке."""
        return any(self.users.get(websocket) == user_id for websocket in self.rooms.get(board_id, ()))

    async def broadcast(self, board_id: int, message: dict) -> None:
        # list(...) — копия, чтобы можно было удалять из комнаты прямо в цикле
        for websocket in list(self.rooms.get(board_id, ())):
            try:
                await websocket.send_json(message)
            except Exception:
                # Вкладку закрыли, а соединение ещё не успело удалиться
                self.disconnect(websocket, board_id)


board_updates = BoardUpdates()


async def send_updates_until_closed(websocket: WebSocket, board_id: int, owner_id: int | None = None) -> None:
    """
    Подключает вкладку к комнате доски и держит соединение, пока вкладку не закроют.
    Сама вкладка ничего не присылает, цикл нужен, только чтобы соединение не закрылось.

    owner_id передаём, когда доску открыл её хозяин: тогда зрители узнают,
    что стример пришёл или ушёл.
    """
    await board_updates.connect(websocket, board_id, owner_id)
    if owner_id is not None:
        await announce_presence(board_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        board_updates.disconnect(websocket, board_id)
        if owner_id is not None:
            # shield: даже если сервер прерывает это соединение (например, выключается),
            # всё равно дописываем уход стримера
            with anyio.CancelScope(shield=True):
                # Запоминаем, когда стример ушёл: зрители увидят «был 5 мин назад».
                # В отдельном потоке, чтобы сервер не замер, пока база занята.
                await anyio.to_thread.run_sync(save_last_seen, owner_id)
                await announce_presence(board_id)


async def announce_presence(board_id: int) -> None:
    """
    Стример открыл или закрыл доску. Отдельного сообщения для этого нет:
    страницы зрителей просто перечитают доску и увидят новый статус.
    """
    await board_updates.broadcast(board_id, {"type": "board_changed"})


def save_last_seen(user_id: int) -> None:
    with open_db() as db:
        db.execute("UPDATE users SET last_seen_at = %s WHERE id = %s", (now(), user_id))


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
