"""
Приём донатов: какие донаты становятся карточками, а какие сразу уходят в историю.

Стример может:
- закрыть приём заказов (например, в конце стрима) — донаты всё равно приходят,
  но не попадают на доску;
- задать минимальную сумму для карточки — донаты меньше неё на доску не попадают;
- игнорировать анонимные донаты (без ника).

Отсеянный донат не теряется: он сразу лежит в истории с пометкой «Отклонено»,
а причиной (archive_note) стоит, почему его отсеяли. Оттуда его можно вернуть на доску.
"""

from .db import Connection, get_board_setting, set_board_setting
from .schemas import IntakeSettings

# Ключи в таблице board_settings
INTAKE_OPEN_KEY = "intake_open"
MIN_AMOUNT_KEY = "min_amount"
IGNORE_ANONYMOUS_KEY = "ignore_anonymous"

# Причины отказа у отсеянных донатов — так их и видно в истории
CLOSED_NOTE = "Приём был закрыт"
BELOW_MIN_NOTE = "Меньше минимальной суммы"
ANONYMOUS_NOTE = "Анонимный донат"


def get_intake_settings(db: Connection, board_id: int) -> IntakeSettings:
    """Настройки приёма. Пока стример ничего не менял: приём открыт, минимума нет, анонимов принимаем."""
    return IntakeSettings(
        open=get_board_setting(db, board_id, INTAKE_OPEN_KEY) != "0",
        min_amount=float(get_board_setting(db, board_id, MIN_AMOUNT_KEY) or 0),
        ignore_anonymous=get_board_setting(db, board_id, IGNORE_ANONYMOUS_KEY) == "1",
    )


def save_intake_settings(db: Connection, board_id: int, settings: IntakeSettings) -> None:
    set_board_setting(db, board_id, INTAKE_OPEN_KEY, "1" if settings.open else "0")
    set_board_setting(db, board_id, MIN_AMOUNT_KEY, str(settings.min_amount))
    set_board_setting(db, board_id, IGNORE_ANONYMOUS_KEY, "1" if settings.ignore_anonymous else "0")


def filter_reason(
    db: Connection,
    board_id: int,
    donor_name: str,
    streamer_amount: float,
) -> str | None:
    """
    Почему донат не должен попасть на доску (причина отказа), или None, если должен.
    Сумму сравниваем в валюте стримера: минимум стример задаёт в своей валюте.
    """
    settings = get_intake_settings(db, board_id)
    if not settings.open:
        return CLOSED_NOTE
    if streamer_amount < settings.min_amount:
        return BELOW_MIN_NOTE
    if settings.ignore_anonymous and not donor_name.strip():
        return ANONYMOUS_NOTE
    return None
