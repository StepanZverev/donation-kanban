// Подсказки ников для поля «Ник» в форме карточки (backend/app/routes/donors.py).

import { request } from './request'

// Ники с доски и из истории, в которых есть эти буквы. Свежие донатеры выше.
export async function getDonorSuggestions(boardId: number, query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query.trim() })
  return request<string[]>('GET', `/api/boards/${boardId}/donors?${params}`)
}
