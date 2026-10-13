// Запросы к API колонок доски.

import type { BoardColumn } from '../types/card'

export async function getColumns(): Promise<BoardColumn[]> {
  const response = await fetch('/api/columns')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить колонки: ${response.status}`)
  }
  return response.json()
}

// Ниже — настройка промежуточных колонок на странице «Настройки».
// «Кучу» и «Выполнено» менять нельзя, бэкенд ответит ошибкой.

export async function createColumn(title: string): Promise<BoardColumn> {
  const response = await fetch('/api/columns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось добавить колонку: ${response.status}`)
  }
  return response.json()
}

export async function renameColumn(id: number, title: string): Promise<BoardColumn> {
  const response = await fetch(`/api/columns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось переименовать колонку: ${response.status}`)
  }
  return response.json()
}

// Карточки удалённой колонки бэкенд вернёт в «Кучу»
export async function deleteColumn(id: number): Promise<void> {
  const response = await fetch(`/api/columns/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Не удалось удалить колонку: ${response.status}`)
  }
}

// Новый порядок промежуточных колонок слева направо — список их id
export async function reorderColumns(columnIds: number[]): Promise<BoardColumn[]> {
  const response = await fetch('/api/columns/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_ids: columnIds }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось переставить колонки: ${response.status}`)
  }
  return response.json()
}
