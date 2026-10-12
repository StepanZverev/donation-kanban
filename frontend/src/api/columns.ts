// Запросы к API колонок доски.

import type { BoardColumn } from '../types/card'

export async function getColumns(): Promise<BoardColumn[]> {
  const response = await fetch('/api/columns')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить колонки: ${response.status}`)
  }
  return response.json()
}
