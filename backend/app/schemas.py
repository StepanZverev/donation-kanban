"""
Схемы — описание того, какие данные приходят в запросах и уходят в ответах.

FastAPI по ним сам проверяет входящий JSON (например, что title — строка
и не пустая) и сам рисует документацию на http://localhost:8000/docs.
"""

from typing import Literal

from pydantic import BaseModel, Field

# Колонки доски. Literal значит «только одно из этих значений».
Status = Literal["queue", "in_progress", "done"]
Source = Literal["manual", "donationalerts"]
ArchiveReason = Literal["done", "deleted"]


class CardCreate(BaseModel):
    """Что присылает фронт, когда создаёт карточку вручную."""

    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    status: Status = "queue"


class CardUpdate(BaseModel):
    """Редактирование. Любое поле можно не присылать — тогда оно не изменится."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class CardMove(BaseModel):
    """Перетаскивание: в какую колонку и на какое место (0 — самый верх)."""

    status: Status
    position: int = Field(ge=0)


class Card(BaseModel):
    """Карточка в том виде, в каком её получает фронт."""

    id: int
    title: str
    description: str
    status: Status
    position: int
    source: Source
    donation_id: int | None
    donor_name: str | None
    amount: float | None
    currency: str | None
    created_at: str
    updated_at: str
    archived_at: str | None
    archive_reason: ArchiveReason | None
