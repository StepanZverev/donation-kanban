// Типы карточек и колонок. Повторяют то, что отдаёт бэкенд (backend/app/schemas.py).

export type CardSource = 'manual' | 'donationalerts'

// Вид колонки:
// incoming — «Куча», куда падают новые донаты (крайняя левая);
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
  archiveReason: 'done' | 'deleted' | null
}

// То, что пользователь вводит в форме создания или редактирования.
export type CardDraft = {
  title: string
  description: string
}
