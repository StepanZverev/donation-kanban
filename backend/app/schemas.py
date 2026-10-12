"""
Схемы — описание того, какие данные приходят в запросах и уходят в ответах.

FastAPI по ним сам проверяет входящий JSON (например, что title — строка
и не пустая) и сам рисует документацию на http://localhost:8000/docs.
"""

from typing import Literal

from pydantic import BaseModel, Field

# Literal значит «только одно из этих значений».
ColumnKind = Literal["incoming", "work", "done"]
Source = Literal["manual", "donationalerts"]
ArchiveReason = Literal["done", "deleted"]


class BoardColumn(BaseModel):
    """Колонка доски."""

    id: int
    title: str
    kind: ColumnKind
    position: int


class CardCreate(BaseModel):
    """
    Что присылает фронт, когда создаёт карточку вручную.
    Если column_id не прислали, карточка попадёт в «Кучу».
    """

    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    column_id: int | None = None


class CardUpdate(BaseModel):
    """Редактирование. Любое поле можно не присылать — тогда оно не изменится."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class CardMove(BaseModel):
    """
    Перенос карточки в другую колонку. Место внутри колонки не выбирается:
    колонка сама сортирует карточки по сумме доната.
    """

    column_id: int


class Card(BaseModel):
    """Карточка в том виде, в каком её получает фронт."""

    id: int
    title: str
    description: str
    column_id: int | None
    source: Source
    donation_id: int | None
    donor_name: str | None
    amount: float | None
    currency: str | None
    streamer_amount: float | None
    created_at: str
    updated_at: str
    moved_at: str
    archived_at: str | None
    archive_reason: ArchiveReason | None
