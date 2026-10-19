"""
Подсказки ников для поля «Ник» в форме карточки.
"""


from fastapi import APIRouter, Depends

from ..board import get_board_id
from ..db import Connection, get_db

router = APIRouter(prefix="/api/boards/{board_id}/donors", tags=["Донатеры"])

# Сколько ников показывать в подсказке
SUGGESTIONS_LIMIT = 8


@router.get("")
def list_donors(
    q: str = "",
    db: Connection = Depends(get_db),
    board_id: int = Depends(get_board_id),
) -> list[str]:
    """
    Ники, в которых есть буквы q (большие и маленькие не различаем), — с доски и из истории.
    Сначала ники, которые начинаются с q, потом остальные. Внутри — кто донатил недавно, тот выше.
    Один и тот же ник в разном регистре («Вася» и «вася») показываем один раз.
    """
    rows = db.execute(
        """
        SELECT donor_name, MAX(created_at) AS last_at
        FROM cards
        WHERE board_id = %s AND donor_name IS NOT NULL AND donor_name != ''
        GROUP BY donor_name
        ORDER BY last_at DESC
        """,
        (board_id,),
    ).fetchall()

    # Как в поиске истории: сравниваем в Python без учёта регистра
    query = q.strip().casefold()
    seen: set[str] = set()
    starts_with: list[str] = []
    contains: list[str] = []
    for row in rows:
        name = row["donor_name"]
        key = name.casefold()
        if key in seen or query not in key:
            continue
        seen.add(key)
        (starts_with if key.startswith(query) else contains).append(name)
    return (starts_with + contains)[:SUGGESTIONS_LIMIT]
