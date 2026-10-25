// Запросы к API истории: карточки, которые убрали с доски.

import type { Card } from '../types/card'
import { toCard, type CardFromApi } from './cards'
import { request } from './request'

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

  const cards = await request<CardFromApi[]>('GET', `/api/boards/${boardId}/history?${params}`)
  return cards.map(toCard)
}

// Возвращает карточку на доску: в указанную колонку, а если её не указали — в «Очередь».
export async function restoreCard(boardId: number, id: number, columnId?: number): Promise<void> {
  await request('POST', `/api/boards/${boardId}/history/${id}/restore`, { column_id: columnId ?? null })
}

// Удаляет карточку из истории насовсем.
export async function deleteForever(boardId: number, id: number): Promise<void> {
  await request('DELETE', `/api/boards/${boardId}/history/${id}`)
}
