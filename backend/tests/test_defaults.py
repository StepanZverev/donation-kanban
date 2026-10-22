"""
Часть настроек по умолчанию повторяется на фронте (frontend/src/defaults.ts).
Тест читает тот файл и проверяет, что значения там такие же, как в app/defaults.py:
поменял в одном месте и забыл в другом — тест упадёт и подскажет, что именно разошлось.
"""

import re
from pathlib import Path

from app import defaults

FRONTEND_DEFAULTS = Path(__file__).resolve().parents[2] / "frontend" / "src" / "defaults.ts"

# Значения, которые есть и на бэкенде, и на фронте (под теми же именами)
SHARED_NAMES = [
    "STREAMER_CURRENCY",
    "EMPTY_MESSAGE_TITLE",
    "MERGE_SEPARATOR",
    "MAX_WORK_COLUMNS",
    "COLUMN_TITLE_MAX_LENGTH",
    "PRIORITY_LEVEL_NAME_MAX_LENGTH",
    "DONOR_NAME_MAX_LENGTH",
    "CARD_TEXT_MAX_LENGTH",
    "REJECT_NOTE_MAX_LENGTH",
    "DONATION_RULES_MAX_LENGTH",
    "MODERATOR_NICKNAME_MAX_LENGTH",
]


def frontend_value(source: str, name: str) -> str:
    """Что написано после `export const NAME = ` в defaults.ts: число или строка в кавычках."""
    match = re.search(rf"^export const {name} = (.+)$", source, flags=re.MULTILINE)
    assert match, f"В frontend/src/defaults.ts нет {name}"
    return match.group(1).strip()


def test_shared_values_match_frontend():
    source = FRONTEND_DEFAULTS.read_text(encoding="utf-8")
    for name in SHARED_NAMES:
        backend_value = getattr(defaults, name)
        expected = f"'{backend_value}'" if isinstance(backend_value, str) else str(backend_value)
        assert frontend_value(source, name) == expected, f"{name} на фронте и на бэкенде разный"


def test_priority_levels_match_frontend():
    source = FRONTEND_DEFAULTS.read_text(encoding="utf-8")
    frontend_levels = [
        (int(min_amount), name, color)
        for min_amount, name, color in re.findall(
            r"\{ minAmount: (\d+), name: '([^']+)', color: '(#[0-9a-fA-F]{6})' \}", source
        )
    ]
    assert frontend_levels == defaults.DEFAULT_PRIORITY_LEVELS
