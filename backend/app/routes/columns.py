"""
Эндпоинты колонок доски. Пока только чтение: настраивать колонки
можно будет позже на странице «Настройки».
"""

import sqlite3

from fastapi import APIRouter, Depends

from ..board import get_columns
from ..db import get_db
from ..schemas import BoardColumn

router = APIRouter(prefix="/api/columns", tags=["Колонки"])


@router.get("")
def list_columns(db: sqlite3.Connection = Depends(get_db)) -> list[BoardColumn]:
    """Все колонки доски слева направо: «Куча», промежуточные, «Выполнено»."""
    return get_columns(db)
