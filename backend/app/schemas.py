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
# merged — карточку слили в другую карточку того же донатера
ArchiveReason = Literal["done", "deleted", "merged"]


class BoardColumn(BaseModel):
    """Колонка доски."""

    id: int
    title: str
    kind: ColumnKind
    position: int


class ColumnCreate(BaseModel):
    """Новая промежуточная колонка. Встаёт последней, прямо перед «Выполнено»."""

    title: str = Field(min_length=1, max_length=40)


class ColumnUpdate(BaseModel):
    """Переименование колонки."""

    title: str = Field(min_length=1, max_length=40)


class ColumnOrder(BaseModel):
    """
    Новый порядок промежуточных колонок слева направо — список их id.
    «Очередь» и «Выполнено» всегда остаются по краям, их сюда не присылают.
    """

    column_ids: list[int]


class PriorityLevel(BaseModel):
    """
    Уровень приоритета карточки. Задаётся только нижней границей суммы:
    уровень действует от min_amount до начала следующего уровня.
    """

    min_amount: float = Field(ge=0)
    name: str = Field(min_length=1, max_length=30)
    # Цвет в виде #rrggbb — именно так его отдаёт <input type="color"> в браузере
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


class AutoMerge(BaseModel):
    """Галочка «Объединять донаты одного донатера автоматически»."""

    enabled: bool


class CardCreate(BaseModel):
    """
    Что присылает фронт, когда создаёт карточку вручную.
    Если column_id не прислали, карточка попадёт в «Очередь».
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


class CardArchive(BaseModel):
    """
    Убрать карточку в историю с нужной пометкой. Так работают зоны по краям доски:
    красная («удалено») и зелёная («выполнено»).
    """

    # «Объединена» сюда не входит: так карточка попадает в историю только через объединение
    reason: Literal["done", "deleted"]


class CardMerge(BaseModel):
    """Какие карточки слить в эту."""

    card_ids: list[int] = Field(min_length=1)


class CardUnmerge(BaseModel):
    """Какие слитые карточки вернуть на доску. None — все."""

    card_ids: list[int] | None = None


class CardRestore(BaseModel):
    """
    Куда вернуть карточку из истории. Если column_id не прислали — в «Очередь».
    Кнопка «Отменить» присылает колонку, где карточка была до этого.
    """

    column_id: int | None = None


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
    merge_count: int
    merged_into_id: int | None
    # Когда пришёл последний донат карточки: у объединённой — самый свежий из слитых.
    # В базе такого столбца нет, его считает list_cards (board.add_last_donation_times).
    last_donation_at: str | None = None
    # Когда в карточку последний раз слили другую (None — не сливали). Тоже считает list_cards.
    last_merged_at: str | None = None
