// Типы карточки. Повторяют то, что отдаёт бэкенд (backend/app/schemas.py).

export type CardStatus = 'queue' | 'in_progress' | 'done'

export type CardSource = 'manual' | 'donationalerts'

export type Card = {
  id: number
  title: string
  description: string
  status: CardStatus
  position: number
  source: CardSource
  donationId: number | null
  donorName: string | null
  amount: number | null
  currency: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  archiveReason: 'done' | 'deleted' | null
}

// То, что пользователь вводит в форме создания или редактирования.
export type CardDraft = {
  title: string
  description: string
}

// Колонки доски в том порядке, в каком они идут слева направо.
export const COLUMNS: { status: CardStatus; title: string }[] = [
  { status: 'queue', title: 'В очереди' },
  { status: 'in_progress', title: 'В работе' },
  { status: 'done', title: 'Выполнено' },
]
