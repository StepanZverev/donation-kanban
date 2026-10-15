"""
Эндпоинты страницы «Настройки»: уровни приоритета карточек, автообъединение
и приём донатов.

Колонки настраиваются через /api/columns (см. columns.py).
"""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..board import get_board_id
from ..db import get_board_setting, get_db, set_board_setting
from ..intake import get_intake_settings, save_intake_settings
from ..merging import AUTO_MERGE_KEY, is_auto_merge_enabled
from ..realtime import notify_board_changed
from ..schemas import AutoMerge, IntakeSettings, PriorityLevel

router = APIRouter(prefix="/api/settings", tags=["Настройки"])

# Ключ в таблице board_settings, под которым уровни лежат одной строкой JSON
PRIORITY_LEVELS_KEY = "priority_levels"

# Уровни, пока стример ничего не менял. Такие же лежат во фронте: src/utils/priority.ts.
# Цвета приглушённые и подобраны так, чтобы сумма этим цветом читалась и на светлой, и на тёмной теме.
DEFAULT_PRIORITY_LEVELS = [
    PriorityLevel(min_amount=0, name="Низкий", color="#85839a"),  # серый
    PriorityLevel(min_amount=100, name="Средний", color="#3f9a68"),  # зелёный
    PriorityLevel(min_amount=500, name="Высокий", color="#c99a24"),  # золотой
    PriorityLevel(min_amount=1000, name="Топ", color="#d6474f"),  # красный
]


@router.get("/priority-levels")
def get_priority_levels(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> list[PriorityLevel]:
    """Уровни приоритета по возрастанию суммы."""
    saved = get_board_setting(db, board_id, PRIORITY_LEVELS_KEY)
    if saved is None:
        return DEFAULT_PRIORITY_LEVELS
    return [PriorityLevel(**level) for level in json.loads(saved)]


@router.put("/priority-levels")
def save_priority_levels(
    levels: list[PriorityLevel],
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
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
    saved = json.dumps([level.model_dump() for level in sorted_levels])
    set_board_setting(db, board_id, PRIORITY_LEVELS_KEY, saved)

    # Открытые доски перезагрузят уровни и перекрасят карточки
    notify_board_changed(db, board_id)
    return sorted_levels


@router.get("/auto-merge")
def get_auto_merge(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> AutoMerge:
    """Включено ли автообъединение донатов одного донатера. По умолчанию выключено."""
    return AutoMerge(enabled=is_auto_merge_enabled(db, board_id))


@router.put("/auto-merge")
def save_auto_merge(
    data: AutoMerge,
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> AutoMerge:
    set_board_setting(db, board_id, AUTO_MERGE_KEY, "1" if data.enabled else "0")
    notify_board_changed(db, board_id)
    return data


@router.get("/intake")
def get_intake(
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> IntakeSettings:
    """Приём донатов: открыт ли, минимальная сумма, игнорировать ли анонимов."""
    return get_intake_settings(db, board_id)


@router.put("/intake")
def save_intake(
    data: IntakeSettings,
    db: sqlite3.Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> IntakeSettings:
    """
    Сохраняет настройки приёма целиком. Переключатель в шапке присылает их тоже целиком,
    поменяв только open.
    """
    save_intake_settings(db, board_id, data)
    # Шапка и настройки в других вкладках увидят, что приём закрыли или открыли
    notify_board_changed(db, board_id)
    return data
