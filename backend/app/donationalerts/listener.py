"""
Фоновые задачи, которые слушают новые донаты DonationAlerts.

У каждого стримера, подключившего DA, своё подключение (строка в таблице da_connections)
и своя фоновая задача DonationListener. Всеми задачами управляет donation_listeners:
запускает их при старте сервера, перезапускает после входа в DA и останавливает,
когда стример отключает DA.

Каждая задача работает, пока запущен бэкенд:
1. Догружает донаты, пришедшие, пока бэкенд был выключен.
2. Подключается к WebSocket DA (сервер Centrifugo) и подписывается на канал донатов.
3. Каждый донат превращает в карточку на доске своего стримера и сообщает вкладкам,
   что доска изменилась.
Если связь оборвалась — ждёт немного и начинает заново.
"""

import asyncio
import json
import logging
import sqlite3

from websockets.asyncio.client import connect as websocket_connect

from .. import config
from ..board import create_board, find_user_board
from ..db import now, open_db
from ..donations import Donation, add_donation_card
from ..realtime import board_updates
from . import client

log = logging.getLogger("donationalerts")

CENTRIFUGO_URL = "wss://centrifugo.donationalerts.com/connection/websocket"
RECONNECT_DELAY_SECONDS = 5
# Сколько страниц истории донатов просматривать при догрузке пропущенных
MAX_MISSED_PAGES = 5

class DonationListener:
    """Слушает донаты одного стримера (user_id — тот, кто подключил DonationAlerts)."""

    def __init__(self, user_id: int) -> None:
        self.user_id = user_id
        # Что сейчас происходит — показываем на фронте:
        # not_connected | connecting | listening | error
        self.status = "connecting"
        self.task: asyncio.Task | None = None

    def start(self) -> None:
        self.task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def run(self) -> None:
        while True:
            connection = read_connection(self.user_id)
            if connection is None:
                # Стример отключил DA — слушать нечего
                self.status = "not_connected"
                return

            try:
                self.status = "connecting"
                await self.listen(connection["access_token"])
            except client.TokenExpiredError:
                log.info("Токен DonationAlerts пользователя %s истёк, обновляю", self.user_id)
                if not await refresh_access_token(self.user_id):
                    self.status = "not_connected"
                    return
                continue
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Связь с DonationAlerts прервалась, переподключаюсь")
                self.status = "error"

            await asyncio.sleep(RECONNECT_DELAY_SECONDS)

    async def listen(self, access_token: str) -> None:
        user = await client.get_user(access_token)
        await import_missed_donations(self.user_id, access_token)

        async with websocket_connect(CENTRIFUGO_URL) as websocket:
            # 1. Представляемся токеном из профиля, в ответ получаем id своего подключения
            await websocket.send(json.dumps({"params": {"token": user["socket_connection_token"]}, "id": 1}))
            reply = json.loads(await websocket.recv())
            centrifugo_client_id = reply["result"]["client"]

            # 2. Просим у DA токен на канал донатов и подписываемся на него
            channel = f"$alerts:donation_{user['id']}"
            channel_token = await client.get_channel_token(access_token, centrifugo_client_id, channel)
            await websocket.send(
                json.dumps({"params": {"channel": channel, "token": channel_token}, "method": 1, "id": 2})
            )

            self.status = "listening"
            log.info("Слушаю донаты DonationAlerts пользователя %s", self.user_id)

            # 3. Ждём сообщения. Одно сообщение может содержать несколько JSON через перевод строки.
            async for raw_message in websocket:
                for line in str(raw_message).splitlines():
                    donation = extract_donation(json.loads(line))
                    if donation:
                        await save_donation(self.user_id, donation)


class DonationListeners:
    """Все слушатели донатов: по одному на каждого стримера, подключившего DonationAlerts."""

    def __init__(self) -> None:
        # id пользователя → его слушатель
        self.listeners: dict[int, DonationListener] = {}

    def start_all(self) -> None:
        """При старте сервера запускаем слушателей всех, кто подключал DA раньше."""
        if not config.is_donationalerts_configured():
            return
        for user_id in connected_user_ids():
            self.start(user_id)

    def start(self, user_id: int) -> None:
        listener = DonationListener(user_id)
        listener.start()
        self.listeners[user_id] = listener

    async def stop(self, user_id: int) -> None:
        listener = self.listeners.pop(user_id, None)
        if listener:
            await listener.stop()

    async def restart(self, user_id: int) -> None:
        """Начать заново — например, после входа в DA."""
        await self.stop(user_id)
        self.start(user_id)

    async def stop_all(self) -> None:
        for user_id in list(self.listeners):
            await self.stop(user_id)

    def status(self, user_id: int) -> str:
        """Что сейчас со слушателем пользователя: not_configured | not_connected | connecting | listening | error."""
        if not config.is_donationalerts_configured():
            return "not_configured"
        listener = self.listeners.get(user_id)
        return listener.status if listener else "not_connected"


def extract_donation(message: dict) -> dict | None:
    """
    Достаёт донат из сообщения Centrifugo. Донат лежит в result.data.data:
    {"result": {"channel": "$alerts:donation_1", "data": {"data": {...донат...}}}}
    Остальные сообщения (ответы на подписку и т.п.) пропускаем.
    """
    data = message.get("result", {}).get("data", {}).get("data")
    if isinstance(data, dict) and "amount" in data:
        return data
    return None


def to_donation(data: dict) -> Donation:
    amount = float(data["amount"])
    # DonationAlerts сам переводит сумму в основную валюту стримера и кладёт её
    # в amount_in_user_currency. Если поля вдруг нет — берём сумму как есть.
    streamer_amount = data.get("amount_in_user_currency")
    return Donation(
        id=int(data["id"]),
        # Аноним приходит без ника. Храним пустую строку, а «Аноним» пишет фронт.
        username=data.get("username") or "",
        # У голосовых донатов текста может не быть
        message=data.get("message") or "",
        amount=amount,
        currency=data.get("currency") or "",
        streamer_amount=float(streamer_amount) if streamer_amount is not None else amount,
    )


async def save_donation(user_id: int, data: dict) -> None:
    """Превращает донат в карточку на доске стримера user_id."""
    donation = to_donation(data)
    with open_db() as db:
        board_id = find_user_board(db, user_id) or create_board(db, user_id)
        added = add_donation_card(db, board_id, donation)
        # Запоминаем самый новый донат, который видели (MAX — чтобы не откатиться назад)
        db.execute(
            "UPDATE da_connections SET last_donation_id = MAX(last_donation_id, ?) WHERE user_id = ?",
            (donation.id, user_id),
        )
    if added:
        log.info("Новый донат от %s", donation.username)
        await board_updates.broadcast(board_id, {"type": "board_changed"})


async def import_missed_donations(user_id: int, access_token: str) -> None:
    """Догружает донаты новее последнего увиденного (они приходят сначала новые)."""
    connection = read_connection(user_id)
    last_id = connection["last_donation_id"] if connection else 0
    missed: list[dict] = []

    for page in range(1, MAX_MISSED_PAGES + 1):
        donations = await client.get_donations(access_token, page)
        newer = [donation for donation in donations if int(donation["id"]) > last_id]
        missed.extend(newer)
        # Дошли до уже известных донатов или до конца списка — дальше не листаем
        if len(newer) < len(donations) or not donations:
            break

    # Добавляем от старых к новым, чтобы в очереди они встали по порядку
    for data in reversed(missed):
        await save_donation(user_id, data)


async def remember_newest_donation(user_id: int, access_token: str) -> None:
    """
    Запоминает самый новый донат на момент входа. Так при первом подключении
    мы не завалим очередь всеми старыми донатами за всё время.
    """
    donations = await client.get_donations(access_token, 1)
    newest_id = max((int(donation["id"]) for donation in donations), default=0)
    with open_db() as db:
        db.execute("UPDATE da_connections SET last_donation_id = ? WHERE user_id = ?", (newest_id, user_id))


async def refresh_access_token(user_id: int) -> bool:
    connection = read_connection(user_id)
    if connection is None or connection["refresh_token"] is None:
        return False
    try:
        tokens = await client.refresh_tokens(connection["refresh_token"])
    except Exception:
        log.exception("Не удалось обновить токен DonationAlerts, нужно войти заново")
        forget_connection(user_id)
        return False
    save_connection(user_id, tokens)
    return True


def save_connection(user_id: int, tokens: dict) -> None:
    """Сохраняет токены DA пользователя: создаёт подключение или обновляет существующее."""
    with open_db() as db:
        # ON CONFLICT: если подключение уже есть, обновляем токены.
        # DA может не прислать новый refresh_token — тогда старый остаётся действующим (COALESCE).
        db.execute(
            """
            INSERT INTO da_connections (user_id, access_token, refresh_token, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = COALESCE(excluded.refresh_token, da_connections.refresh_token)
            """,
            (user_id, tokens["access_token"], tokens.get("refresh_token"), now()),
        )


def forget_connection(user_id: int) -> None:
    with open_db() as db:
        db.execute("DELETE FROM da_connections WHERE user_id = ?", (user_id,))


def read_connection(user_id: int) -> sqlite3.Row | None:
    with open_db() as db:
        return db.execute("SELECT * FROM da_connections WHERE user_id = ?", (user_id,)).fetchone()


def connected_user_ids() -> list[int]:
    with open_db() as db:
        return [row["user_id"] for row in db.execute("SELECT user_id FROM da_connections")]


donation_listeners = DonationListeners()
