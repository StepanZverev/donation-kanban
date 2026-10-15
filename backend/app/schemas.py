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
# merged — карточку слили в другую карточку того же донатера,
# rejected — стример отказался выполнять просьбу или донат отсеян настройками приёма
# (причина лежит в archive_note)
ArchiveReason = Literal["done", "deleted", "merged", "rejected"]


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


class IntakeSettings(BaseModel):
    """Раздел «Приём донатов»: какие донаты становятся карточками (см. intake.py)."""

    # Принимать заказы. Выключено — донаты сразу уходят в историю с пометкой «приём закрыт».
    open: bool
    # Донаты меньше этой суммы (в валюте стримера) на доску не попадают. 0 — без минимума.
    min_amount: float = Field(ge=0)
    # Донаты без ника на доску не попадают
    ignore_anonymous: bool


class CardCreate(BaseModel):
    """
    Что присылает фронт, когда создаёт карточку вручную.
    Если column_id не прислали, карточка попадёт в «Очередь».
    """

    # Карточка — как донат: ник, текст и сумма. Без ника — аноним, без текста —
    # «Донат без сообщения». Сумма — в валюте стримера (рубли), её можно не указывать.
    donor_name: str | None = Field(default=None, max_length=100)
    text: str = Field(default="", max_length=2000)
    amount: float | None = Field(default=None, ge=0)
    column_id: int | None = None


class CardUpdate(BaseModel):
    """
    Редактирование. Любое поле можно не присылать — тогда оно не изменится.
    Прислать donor_name или amount равными null — значит стереть ник или сумму.
    """

    donor_name: str | None = Field(default=None, max_length=100)
    text: str | None = Field(default=None, max_length=2000)
    # Сумма в валюте карточки: у доната в долларах — в долларах (см. routes/cards.py)
    amount: float | None = Field(default=None, ge=0)


class CardMove(BaseModel):
    """
    Перенос карточки в другую колонку. Место внутри колонки не выбирается:
    колонка сама сортирует карточки по сумме доната.
    """

    column_id: int


class CardArchive(BaseModel):
    """
    Убрать карточку в историю с нужной пометкой. Так работают зоны по краям доски:
    красная («удалено») и зелёная («выполнено»), а ещё «Отклонить» в меню карточки.
    """

    # «Объединена» сюда не входит: так карточка попадает в историю только через объединение
    reason: Literal["done", "deleted", "rejected"]
    # Причина отказа для «Отклонено», например «не по правилам канала». Можно не писать.
    note: str = Field(default="", max_length=200)


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
    # Пояснение к пометке: у «Отклонено» — причина отказа (её пишет стример или
    # ставят настройки приёма, см. intake.py). Пусто, если пояснения нет.
    archive_note: str | None
    merge_count: int
    merged_into_id: int | None
    # Когда пришёл последний донат карточки: у объединённой — самый свежий из слитых.
    # В базе такого столбца нет, его считает list_cards (board.add_last_donation_times).
    last_donation_at: str | None = None
    # Когда в карточку последний раз слили другую (None — не сливали). Тоже считает list_cards.
    last_merged_at: str | None = None


class LatestDonations(BaseModel):
    """
    Когда пришли самые свежие донаты. По этим временам фронт ставит точку «есть новое»
    у вкладок «Доска» и «История». None — таких донатов ещё не было.
    """

    # Самый свежий донат, который попал на доску
    on_board: str | None
    # Самый свежий донат, который сразу ушёл в историю (отсеян настройками приёма)
    to_history: str | None


class StreamTotal(BaseModel):
    """Сумма за стрим в шапке (см. routes/stream.py)."""

    # Сумма донатов с последнего сброса, в валюте стримера
    total: float
    # Сколько донатов пришло с последнего сброса
    donation_count: int
    # Сколько карточек сейчас на доске — столько уйдёт в историю при сбросе
    board_card_count: int


class CurrentUser(BaseModel):
    """Кто открыл сайт. Гость — пока не подключил ни одного способа входа."""

    id: int
    name: str | None
    avatar_url: str | None
    is_guest: bool
    logins: list[str]  # например ["donationalerts"]
    # Можно ли сейчас подключить DonationAlerts (вписаны ли ключи в backend/.env)
    can_connect_donationalerts: bool


class ViewerSettings(BaseModel):
    """Раздел настроек «Для зрителей»."""

    # Секретная часть ссылки для зрителей (/v/<public_token>). None — ссылка выключена.
    public_token: str | None
    # Ссылка на страницу доната. Пустая строка — кнопки «+» у зрителей нет.
    donation_url: str


class DonationUrl(BaseModel):
    url: str = Field(max_length=300)


class PublicCard(BaseModel):
    """
    Карточка для зрителей: только то, что и так видно на стриме.
    Служебных полей (история, пометки, id доната) здесь нет.
    """

    id: int
    title: str
    description: str
    column_id: int | None
    donor_name: str | None
    amount: float | None
    currency: str | None
    streamer_amount: float | None
    merge_count: int


class PublicBoard(BaseModel):
    """Всё, что нужно странице для зрителей."""

    # Имя стримера из DonationAlerts. None — гость, имени нет.
    streamer_name: str | None
    columns: list[BoardColumn]
    cards: list[PublicCard]
    priority_levels: list[PriorityLevel]
    # Пустая строка — стример не указал ссылку на донат
    donation_url: str
    # Принимает ли стример заказы прямо сейчас
    intake_open: bool
