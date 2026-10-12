"""
Фоновая задача, которая слушает новые донаты DonationAlerts.

Работает всё время, пока запущен бэкенд:
1. Если DA не подключён — ждёт, пока пользователь войдёт.
2. Догружает донаты, пришедшие, пока бэкенд был выключен.
3. Подключается к WebSocket DA (сервер Centrifugo) и подписывается на канал донатов.
4. Каждый донат превращает в карточку и сообщает вкладкам, что доска изменилась.
Если связь оборвалась — ждёт немного и начинает заново.
"""

import asyncio
import json
import logging

from websockets.asyncio.client import connect as websocket_connect

from .. import config
from ..db import delete_setting, get_setting, open_db, set_setting
from ..donations import Donation, add_donation_card
from ..realtime import board_updates
from . import client

log = logging.getLogger("donationalerts")

CENTRIFUGO_URL = "wss://centrifugo.donationalerts.com/connection/websocket"
RECONNECT_DELAY_SECONDS = 5
# Сколько страниц истории донатов просматривать при догрузке пропущенных
MAX_MISSED_PAGES = 5

# Ключи в таблице settings
ACCESS_TOKEN = "da_access_token"
REFRESH_TOKEN = "da_refresh_token"
# id самого нового доната, который мы уже видели. Всё, что новее, — пропущенное.
LAST_DONATION_ID = "da_last_donation_id"


class DonationListener:
    def __init__(self) -> None:
        # Что сейчас происходит — показываем на фронте:
        # not_configured | not_connected | connecting | listening | error
        self.status = "not_connected"
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

    async def restart(self) -> None:
        """Начать заново — например, после входа в DA или выхода из него."""
        await self.stop()
        self.start()

    async def run(self) -> None:
        if not config.is_donationalerts_configured():
            self.status = "not_configured"
            return

        while True:
            access_token = read_setting(ACCESS_TOKEN)
            if access_token is None:
                # Ждать нечего: restart() перезапустит задачу после входа.
                self.status = "not_connected"
                return

            try:
                self.status = "connecting"
                await self.listen(access_token)
            except client.TokenExpiredError:
                log.info("Токен DonationAlerts истёк, обновляю")
                if not await refresh_access_token():
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
        await import_missed_donations(access_token)

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
            log.info("Слушаю донаты DonationAlerts")

            # 3. Ждём сообщения. Одно сообщение может содержать несколько JSON через перевод строки.
            async for raw_message in websocket:
                for line in str(raw_message).splitlines():
                    donation = extract_donation(json.loads(line))
                    if donation:
                        await save_donation(donation)


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
        username=data.get("username") or "Аноним",
        # У голосовых донатов текста может не быть
        message=data.get("message") or "",
        amount=amount,
        currency=data.get("currency") or "",
        streamer_amount=float(streamer_amount) if streamer_amount is not None else amount,
    )


async def save_donation(data: dict) -> None:
    donation = to_donation(data)
    with open_db() as db:
        added = add_donation_card(db, donation)
        last_id = int(get_setting(db, LAST_DONATION_ID) or 0)
        if donation.id > last_id:
            set_setting(db, LAST_DONATION_ID, str(donation.id))
    if added:
        log.info("Новый донат от %s", donation.username)
        await board_updates.broadcast({"type": "board_changed"})


async def import_missed_donations(access_token: str) -> None:
    """Догружает донаты новее последнего увиденного (они приходят сначала новые)."""
    last_id = int(read_setting(LAST_DONATION_ID) or 0)
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
        await save_donation(data)


async def remember_newest_donation(access_token: str) -> None:
    """
    Запоминает самый новый донат на момент входа. Так при первом подключении
    мы не завалим очередь всеми старыми донатами за всё время.
    """
    donations = await client.get_donations(access_token, 1)
    newest_id = max((int(donation["id"]) for donation in donations), default=0)
    with open_db() as db:
        set_setting(db, LAST_DONATION_ID, str(newest_id))


async def refresh_access_token() -> bool:
    refresh_token = read_setting(REFRESH_TOKEN)
    if refresh_token is None:
        return False
    try:
        tokens = await client.refresh_tokens(refresh_token)
    except Exception:
        log.exception("Не удалось обновить токен DonationAlerts, нужно войти заново")
        forget_tokens()
        return False
    save_tokens(tokens)
    return True


def save_tokens(tokens: dict) -> None:
    with open_db() as db:
        set_setting(db, ACCESS_TOKEN, tokens["access_token"])
        # DA может не прислать новый refresh_token — тогда старый остаётся действующим
        if tokens.get("refresh_token"):
            set_setting(db, REFRESH_TOKEN, tokens["refresh_token"])


def forget_tokens() -> None:
    with open_db() as db:
        delete_setting(db, ACCESS_TOKEN)
        delete_setting(db, REFRESH_TOKEN)


def read_setting(key: str) -> str | None:
    with open_db() as db:
        return get_setting(db, key)


donation_listener = DonationListener()
