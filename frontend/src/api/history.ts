// Запросы к API истории: карточки, которые убрали с доски.

import type { Card } from '../types/card'
import { toCard, type CardFromApi } from './cards'

// Какие карточки истории показать. reason — только с этой пометкой (null — все),
// query — поиск по нику и тексту (пустая строка — без поиска).
export type HistoryFilter = {
  reason: NonNullable<Card['archiveReason']> | null
  query: string
}

export async function getHistory(boardId: number, filter: HistoryFilter): Promise<Card[]> {
  // URLSearchParams сам закодирует русские буквы и пробелы для адреса
  const params = new URLSearchParams()
  if (filter.reason) {
    params.set('reason', filter.reason)
  }
  if (filter.query.trim()) {
    params.set('q', filter.query.trim())
  }

  const response = await fetch(`/api/boards/${boardId}/history?${params}`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить историю: ${response.status}`)
  }
  const cards: CardFromApi[] = await response.json()
  return cards.map(toCard)
}

// Возвращает карточку на доску: в указанную колонку, а если её не указали — в «Очередь».
export async function restoreCard(boardId: number, id: number, columnId?: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/history/${id}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: columnId ?? null }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось переоткрыть карточку: ${response.status}`)
  }
}

// Удаляет карточку из истории насовсем.
export async function deleteForever(boardId: number, id: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/history/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Не удалось удалить карточку: ${response.status}`)
  }
}
