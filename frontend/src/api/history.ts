// Запросы к API истории: карточки, которые убрали с доски.

import type { Card } from '../types/card'
import { toCard, type CardFromApi } from './cards'

export async function getHistory(): Promise<Card[]> {
  const response = await fetch('/api/history')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить историю: ${response.status}`)
  }
  const cards: CardFromApi[] = await response.json()
  return cards.map(toCard)
}

// Возвращает карточку на доску в конец колонки «В очереди».
export async function restoreCard(id: number): Promise<void> {
  const response = await fetch(`/api/history/${id}/restore`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось переоткрыть карточку: ${response.status}`)
  }
}

// Удаляет карточку из истории насовсем.
export async function deleteForever(id: number): Promise<void> {
  const response = await fetch(`/api/history/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Не удалось удалить карточку: ${response.status}`)
  }
}
