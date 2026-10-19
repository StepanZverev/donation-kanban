// Типы карточек и колонок. Повторяют то, что отдаёт бэкенд (backend/app/schemas.py).

export type CardSource = 'manual' | 'donationalerts'

// Вид колонки:
// incoming — «Очередь», куда падают новые донаты (крайняя левая);
// work — промежуточные колонки, например «В работе»;
// done — «Выполнено» (крайняя правая).
export type ColumnKind = 'incoming' | 'work' | 'done'

export type BoardColumn = {
  id: number
  title: string
  kind: ColumnKind
  position: number
}

export type Card = {
  id: number
  title: string
  description: string
  columnId: number | null
  source: CardSource
  donationId: number | null
  // Пустая строка — анонимный донат. На экран ник выводим через getDonorName (utils/donor.ts).
  donorName: string | null
  amount: number | null
  currency: string | null
  // Сумма в валюте стримера: по ней бэкенд сортирует карточки в колонке
  streamerAmount: number | null
  createdAt: string
  updatedAt: string
  // Когда карточка попала в текущую колонку
  movedAt: string
  archivedAt: string | null
  // merged — карточку слили в другую карточку того же донатера,
  // rejected — стример отказался выполнять просьбу или донат отсеян настройками приёма
  archiveReason: 'done' | 'deleted' | 'merged' | 'rejected' | null
  // Пояснение к пометке: у «Отклонено» — причина отказа, её пишет стример или ставят
  // настройки приёма («Приём был закрыт»). null — без пояснения.
  archiveNote: string | null
  // Имя модератора, который убрал карточку в историю. null — убрал сам стример.
  archivedBy: string | null
  // Сколько донатов слито в карточку: 1 — обычная, 2 и больше — объединённая
  mergeCount: number
  // В какую карточку слили эту (только у карточек в истории с пометкой merged)
  mergedIntoId: number | null
  // Время самого свежего доната в карточке (с учётом слитых в неё). Для «5 мин назад».
  // Приходит только у карточек на доске, в истории — null.
  lastDonationAt: string | null
  // Когда в карточку последний раз слили другую (null — не сливали). Для подсветки после слияния.
  lastMergedAt: string | null
}

// То, что пользователь вводит в форме создания или редактирования.
// Карточка устроена как донат: ник, текст и сумма.
export type CardDraft = {
  // Ник донатера. Пустая строка — без ника (у доната — аноним).
  donorName: string
  text: string
  // Сумма в валюте карточки, null — без суммы
  amount: number | null
}

// Карточка на странице для зрителей: только то, что и так видно на стриме
export type PublicCard = Pick<
  Card,
  | 'id'
  | 'title'
  | 'description'
  | 'columnId'
  | 'donorName'
  | 'amount'
  | 'currency'
  | 'streamerAmount'
  | 'mergeCount'
>
