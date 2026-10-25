// Запросы для разработки.

import { request } from './request'

// Просит бэкенд создать карточку из выдуманного доната.
export async function sendFakeDonation(boardId: number): Promise<void> {
  await request('POST', `/api/boards/${boardId}/dev/fake-donation`)
}
