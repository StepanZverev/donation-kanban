"""
Эндпоинты страницы «Настройки»: уровни приоритета карточек.

Колонки настраиваются через /api/columns (см. columns.py).
"""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db, get_setting, set_setting
from ..realtime import notify_board_changed
from ..schemas import PriorityLevel

router = APIRouter(prefix="/api/settings", tags=["Настройки"])

# Ключ в таблице settings, под которым уровни лежат одной строкой JSON
PRIORITY_LEVELS_KEY = "priority_levels"

# Уровни, пока стример ничего не менял
DEFAULT_PRIORITY_LEVELS = [
    PriorityLevel(min_amount=0, name="Низкий", color="#8c959f"),
    PriorityLevel(min_amount=100, name="Средний", color="#d4a72c"),
    PriorityLevel(min_amount=500, name="Высокий", color="#cf222e"),
]


@router.get("/priority-levels")
def get_priority_levels(db: sqlite3.Connection = Depends(get_db)) -> list[PriorityLevel]:
    """Уровни приоритета по возрастанию суммы."""
    saved = get_setting(db, PRIORITY_LEVELS_KEY)
    if saved is None:
        return DEFAULT_PRIORITY_LEVELS
    return [PriorityLevel(**level) for level in json.loads(saved)]


@router.put("/priority-levels")
def save_priority_levels(
    levels: list[PriorityLevel], db: sqlite3.Connection = Depends(get_db)
) -> list[PriorityLevel]:
    """
    Сохраняет уровни целиком. Порядок не важен: сервер сам отсортирует их по сумме.

    Проверяем две вещи, чтобы у любой суммы был ровно один уровень:
    - есть уровень, который начинается с 0;
    - нет двух уровней с одной и той же нижней границей.
    """
    amounts = [level.min_amount for level in levels]
    if 0 not in amounts:
        raise HTTPException(status_code=400, detail="Нужен уровень, который начинается с 0")
    if len(set(amounts)) != len(amounts):
        raise HTTPException(status_code=400, detail="У двух уровней одинаковая сумма «от»")

    sorted_levels = sorted(levels, key=lambda level: level.min_amount)
    set_setting(db, PRIORITY_LEVELS_KEY, json.dumps([level.model_dump() for level in sorted_levels]))

    # Открытые доски перезагрузят уровни и перекрасят карточки
    notify_board_changed(db)
    return sorted_levels
