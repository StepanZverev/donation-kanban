// Запросы к API колонок доски.

import type { BoardColumn } from '../types/card'
import { request } from './request'

export async function getColumns(boardId: number): Promise<BoardColumn[]> {
  return request<BoardColumn[]>('GET', `/api/boards/${boardId}/columns`)
}

// Ниже — настройка промежуточных колонок на странице «Настройки».
// «Очередь» и «Выполнено» менять нельзя, бэкенд ответит ошибкой.

export async function createColumn(boardId: number, title: string): Promise<BoardColumn> {
  return request<BoardColumn>('POST', `/api/boards/${boardId}/columns`, { title })
}

export async function renameColumn(boardId: number, id: number, title: string): Promise<BoardColumn> {
  return request<BoardColumn>('PATCH', `/api/boards/${boardId}/columns/${id}`, { title })
}

// Карточки удалённой колонки бэкенд вернёт в «Очередь»
export async function deleteColumn(boardId: number, id: number): Promise<void> {
  await request('DELETE', `/api/boards/${boardId}/columns/${id}`)
}

// Новый порядок промежуточных колонок слева направо — список их id
export async function reorderColumns(boardId: number, columnIds: number[]): Promise<BoardColumn[]> {
  return request<BoardColumn[]>('PUT', `/api/boards/${boardId}/columns/order`, { column_ids: columnIds })
}
