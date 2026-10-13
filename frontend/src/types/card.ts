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
  // merged — карточку слили в другую карточку того же донатера
  archiveReason: 'done' | 'deleted' | 'merged' | null
  // Сколько донатов слито в карточку: 1 — обычная, 2 и больше — со значком «×2»
  mergeCount: number
  // В какую карточку слили эту (только у карточек в истории с пометкой merged)
  mergedIntoId: number | null
  // Когда в карточку последний раз что-то слили и что именно («+300 ₽ от Васи»)
  lastMergedAt: string | null
  lastMergeNote: string | null
}

// То, что пользователь вводит в форме создания или редактирования.
export type CardDraft = {
  title: string
  description: string
}
