// Можно ли объединить карточку с другой карточкой того же донатера.
// То же правило, что на бэкенде (backend/app/merging.py), — здесь оно нужно,
// чтобы знать, показывать ли на карточке кнопку «Объединить».
//
// Объединять можно только карточку из «Очереди». Сливается она:
// - в карточку донатера в промежуточной колонке (например, «В работе»), если такая есть;
// - иначе в его самую старую карточку в «Очереди».
// «Выполнено» и история не участвуют.

import type { BoardColumn, Card } from '../types/card'

export function findMergeTarget(card: Card, cards: Card[], columns: BoardColumn[]) {
  const columnKind = (columnId: number | null) => columns.find((column) => column.id === columnId)?.kind

  if (!card.donorName || columnKind(card.columnId) !== 'incoming') {
    return null
  }

  // Карточки того же донатера, от старых к новым. Ник без учёта регистра: «Вася» = «вася».
  const donor = card.donorName.toLowerCase()
  const sameDonor = cards
    .filter((other) => other.id !== card.id && other.donorName?.toLowerCase() === donor)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)

  const inWork = sameDonor.find((other) => columnKind(other.columnId) === 'work')
  if (inWork) {
    return inWork
  }

  const olderInQueue = sameDonor.find(
    (other) => columnKind(other.columnId) === 'incoming' && isOlder(other, card),
  )
  return olderInQueue ?? null
}

function isOlder(a: Card, b: Card) {
  return a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id)
}
