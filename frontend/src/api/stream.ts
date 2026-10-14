// Запросы к API суммы за стрим и сброса доски (backend/app/routes/stream.py).

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

export async function getStreamTotal(): Promise<StreamTotal> {
  const response = await fetch('/api/stream-total')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить сумму за стрим: ${response.status}`)
  }
  return toStreamTotal(await response.json())
}

// «Сбросить доску»: сумма обнуляется, все карточки уходят в историю
export async function resetBoard(): Promise<StreamTotal> {
  const response = await fetch('/api/board/reset', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось сбросить доску: ${response.status}`)
  }
  return toStreamTotal(await response.json())
}
