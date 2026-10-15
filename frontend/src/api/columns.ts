// Запросы к API колонок доски.

import type { BoardColumn } from '../types/card'

export async function getColumns(boardId: number): Promise<BoardColumn[]> {
  const response = await fetch(`/api/boards/${boardId}/columns`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить колонки: ${response.status}`)
  }
  return response.json()
}

// Ниже — настройка промежуточных колонок на странице «Настройки».
// «Очередь» и «Выполнено» менять нельзя, бэкенд ответит ошибкой.

export async function createColumn(boardId: number, title: string): Promise<BoardColumn> {
  const response = await fetch(`/api/boards/${boardId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось добавить колонку: ${response.status}`)
  }
  return response.json()
}

export async function renameColumn(boardId: number, id: number, title: string): Promise<BoardColumn> {
  const response = await fetch(`/api/boards/${boardId}/columns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось переименовать колонку: ${response.status}`)
  }
  return response.json()
}

// Карточки удалённой колонки бэкенд вернёт в «Очередь»
export async function deleteColumn(boardId: number, id: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/columns/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Не удалось удалить колонку: ${response.status}`)
  }
}

// Новый порядок промежуточных колонок слева направо — список их id
export async function reorderColumns(boardId: number, columnIds: number[]): Promise<BoardColumn[]> {
  const response = await fetch(`/api/boards/${boardId}/columns/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_ids: columnIds }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось переставить колонки: ${response.status}`)
  }
  return response.json()
}
