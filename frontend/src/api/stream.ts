// Запросы к API суммы за стрим и сброса доски (backend/app/routes/stream.py).

import { request } from './request'

export type StreamTotal = {
  // Сумма донатов с последнего сброса, в валюте стримера
  total: number
  // Сколько донатов пришло с последнего сброса
  donationCount: number
  // Сколько карточек сейчас на доске — столько уйдёт в историю при сбросе
  boardCardCount: number
}

type StreamTotalFromApi = {
  total: number
  donation_count: number
  board_card_count: number
}

function toStreamTotal(body: StreamTotalFromApi): StreamTotal {
  return { total: body.total, donationCount: body.donation_count, boardCardCount: body.board_card_count }
}

export async function getStreamTotal(boardId: number): Promise<StreamTotal> {
  return toStreamTotal(await request<StreamTotalFromApi>('GET', `/api/boards/${boardId}/stream-total`))
}

// «Сбросить доску»: сумма обнуляется, все карточки уходят в историю
export async function resetBoard(boardId: number): Promise<StreamTotal> {
  return toStreamTotal(await request<StreamTotalFromApi>('POST', `/api/boards/${boardId}/reset`))
}
