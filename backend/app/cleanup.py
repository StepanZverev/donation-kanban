"""
Уборка базы. Раз в сутки (CLEANUP_INTERVAL_HOURS) сервер удаляет то, что уже никому не нужно.

Зачем: каждый новый браузер получает гостя и пустую доску. Их создают и случайные посетители,
и поисковые роботы, которые заходят на сайт. Без уборки таблицы росли бы бесконечно.

Удаляем:
- брошенных гостей: не подключали DonationAlerts, не модерируют чужие доски,
  на их доске нет ни одной карточки (даже в истории), и они не заходили дольше
  ABANDONED_GUEST_DAYS дней. Вместе с гостем удаляется его пустая доска;
- старую историю: карточки, которые ушли в историю больше OLD_HISTORY_DAYS дней назад
  (так обещано в политике конфиденциальности). Карточки на доске не трогаем, сколько бы
  они там ни лежали;
- просроченные сессии: по ним всё равно уже нельзя войти.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from .db import Connection, now, open_db
from .defaults import ABANDONED_GUEST_DAYS, CLEANUP_INTERVAL_HOURS, OLD_HISTORY_DAYS

log = logging.getLogger("cleanup")


def days_ago(days: int) -> str:
    """Момент «столько-то дней назад» строкой в том же виде, что и время в базе (см. db.now)."""
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="milliseconds")


def find_abandoned_guests(db: Connection) -> list[int]:
    """id гостей, которых можно удалить (правила — в описании файла)."""
    seen_before = days_ago(ABANDONED_GUEST_DAYS)
    # NOT EXISTS (...) — «нет ни одной такой строки»
    rows = db.execute(
        """
        SELECT u.id FROM users u
        WHERE u.last_seen_at < %s
          AND NOT EXISTS (SELECT 1 FROM user_logins l WHERE l.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM da_connections c WHERE c.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM board_members m WHERE m.user_id = u.id)
          AND NOT EXISTS (
              SELECT 1 FROM boards b JOIN cards c ON c.board_id = b.id WHERE b.owner_id = u.id
          )
        """,
        (seen_before,),
    )
    return [row["id"] for row in rows]


def delete_users(db: Connection, user_ids: list[int]) -> None:
    """
    Удаляет пользователей со всеми их данными: доски с карточками и историей, подключение
    DonationAlerts, способы входа, сессии, модераторство на чужих досках.
    Нужно и уборке брошенных гостей, и кнопке «Удалить аккаунт» (routes/me.py).
    Порядок важен: сначала то, что ссылается на доску и пользователя.
    """
    # = ANY(%s): «id входит в список»; список Python psycopg передаёт как массив
    boards = "SELECT id FROM boards WHERE owner_id = ANY(%s)"
    db.execute(f"DELETE FROM cards WHERE board_id IN ({boards})", (user_ids,))
    db.execute(f"DELETE FROM board_members WHERE board_id IN ({boards})", (user_ids,))
    # Модераторство на чужих досках. Подпись «убрал модератор Имя» в чужой истории остаётся:
    # это имя, а не ссылка на пользователя (см. migrations/002_card_archived_by.sql)
    db.execute("DELETE FROM board_members WHERE user_id = ANY(%s)", (user_ids,))
    db.execute(f"DELETE FROM board_settings WHERE board_id IN ({boards})", (user_ids,))
    db.execute(f"DELETE FROM board_columns WHERE board_id IN ({boards})", (user_ids,))
    db.execute("DELETE FROM boards WHERE owner_id = ANY(%s)", (user_ids,))
    db.execute("DELETE FROM sessions WHERE user_id = ANY(%s)", (user_ids,))
    db.execute("DELETE FROM da_connections WHERE user_id = ANY(%s)", (user_ids,))
    db.execute("DELETE FROM user_logins WHERE user_id = ANY(%s)", (user_ids,))
    db.execute("DELETE FROM users WHERE id = ANY(%s)", (user_ids,))


def delete_old_history(db: Connection) -> int:
    """
    Удаляет карточки, которые лежат в истории дольше OLD_HISTORY_DAYS дней. Возвращает, сколько удалено.

    Тонкость с объединёнными карточками: слитая карточка лежит в истории (archive_reason = merged)
    и ссылается на основную через merged_into_id — по ней работает «Разъединить». Если основная
    карточка ещё на доске или недавно в истории, слитые в неё оставляем, даже старые.
    Поэтому сначала собираем «что оставить»: свежие карточки и всё, что в них слито
    (WITH RECURSIVE проходит по цепочке: слитая карточка могла и сама быть объединённой).
    """
    archived_before = days_ago(OLD_HISTORY_DAYS)
    return db.execute(
        """
        WITH RECURSIVE kept AS (
            SELECT id FROM cards WHERE archived_at IS NULL OR archived_at >= %s
            UNION
            SELECT c.id FROM cards c JOIN kept k ON c.merged_into_id = k.id
        )
        DELETE FROM cards WHERE archived_at < %s AND id NOT IN (SELECT id FROM kept)
        """,
        (archived_before, archived_before),
    ).rowcount


def clean_up(db: Connection) -> None:
    guests = find_abandoned_guests(db)
    if guests:
        delete_users(db, guests)
    old_cards = delete_old_history(db)
    expired = db.execute("DELETE FROM sessions WHERE expires_at < %s", (now(),)).rowcount
    log.info(
        "Уборка: удалено гостей — %s, старых карточек из истории — %s, просроченных сессий — %s",
        len(guests),
        old_cards,
        expired,
    )


async def clean_up_forever() -> None:
    """Фоновая задача: уборка сразу при старте сервера, дальше раз в CLEANUP_INTERVAL_HOURS часов."""
    while True:
        try:
            # Запросы к базе обычные (не async), поэтому выполняем их в отдельном потоке,
            # чтобы сервер в это время продолжал отвечать на запросы
            await asyncio.to_thread(run_clean_up)
        except Exception:
            # Ошибка уборки не должна останавливать сервер: попробуем в следующий раз
            log.exception("Уборка не удалась")
        await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 60 * 60)


def run_clean_up() -> None:
    with open_db() as db:
        clean_up(db)
