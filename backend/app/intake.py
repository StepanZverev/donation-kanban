"""
Приём донатов: какие донаты становятся карточками, а какие сразу уходят в историю.

Стример может:
- закрыть приём заказов (например, в конце стрима) — донаты всё равно приходят,
  но не попадают на доску;
- задать минимальную сумму для карточки — донаты меньше неё на доску не попадают;
- игнорировать анонимные донаты (без ника);
- написать свои правила доната текстом — их видят зрители, на отсев они не влияют.

Отсеянный донат не теряется: он сразу лежит в истории с пометкой «Отклонено»,
а причиной (archive_note) стоит, почему его отсеяли. Оттуда его можно вернуть на доску.
"""

from .db import Connection, get_board_setting, set_board_setting
from .defaults import (
    ANONYMOUS_NOTE,
    BELOW_MIN_NOTE,
    CLOSED_NOTE,
    IGNORE_ANONYMOUS_BY_DEFAULT,
    INTAKE_OPEN_BY_DEFAULT,
    MIN_AMOUNT_BY_DEFAULT,
)
from .schemas import IntakeSettings

# Ключи в таблице board_settings
INTAKE_OPEN_KEY = "intake_open"
MIN_AMOUNT_KEY = "min_amount"
IGNORE_ANONYMOUS_KEY = "ignore_anonymous"
RULES_KEY = "donation_rules"


def get_intake_settings(db: Connection, board_id: int) -> IntakeSettings:
    """Настройки приёма. Чего стример ещё не менял, берём по умолчанию (см. defaults.py)."""
    open_saved = get_board_setting(db, board_id, INTAKE_OPEN_KEY)
    min_amount_saved = get_board_setting(db, board_id, MIN_AMOUNT_KEY)
    ignore_anonymous_saved = get_board_setting(db, board_id, IGNORE_ANONYMOUS_KEY)
    return IntakeSettings(
        open=INTAKE_OPEN_BY_DEFAULT if open_saved is None else open_saved == "1",
        min_amount=MIN_AMOUNT_BY_DEFAULT if min_amount_saved is None else float(min_amount_saved),
        ignore_anonymous=IGNORE_ANONYMOUS_BY_DEFAULT if ignore_anonymous_saved is None else ignore_anonymous_saved == "1",
        rules=get_board_setting(db, board_id, RULES_KEY) or "",
    )


def save_intake_settings(db: Connection, board_id: int, settings: IntakeSettings) -> None:
    set_board_setting(db, board_id, INTAKE_OPEN_KEY, "1" if settings.open else "0")
    set_board_setting(db, board_id, MIN_AMOUNT_KEY, str(settings.min_amount))
    set_board_setting(db, board_id, IGNORE_ANONYMOUS_KEY, "1" if settings.ignore_anonymous else "0")
    # Пробелы и пустые строки по краям не нужны: «   » — это тоже «правил нет»
    set_board_setting(db, board_id, RULES_KEY, settings.rules.strip())


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
