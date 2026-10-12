// Запросы к API карточек. Компоненты не вызывают fetch напрямую,
// а пользуются функциями отсюда.

import type { Card, CardDraft } from '../types/card'

// Бэкенд пишет поля в snake_case (donor_name), а во фронте принят camelCase (donorName).
// Описываем, в каком виде карточка приходит с сервера, и переводим её в наш тип.
export type CardFromApi = {
  id: number
  title: string
  description: string
  column_id: number | null
  source: Card['source']
  donation_id: number | null
  donor_name: string | null
  amount: number | null
  currency: string | null
  streamer_amount: number | null
  created_at: string
  updated_at: string
  moved_at: string
  archived_at: string | null
  archive_reason: Card['archiveReason']
}

export function toCard(card: CardFromApi): Card {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    columnId: card.column_id,
    source: card.source,
    donationId: card.donation_id,
    donorName: card.donor_name,
    amount: card.amount,
    currency: card.currency,
    streamerAmount: card.streamer_amount,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
    movedAt: card.moved_at,
    archivedAt: card.archived_at,
    archiveReason: card.archive_reason,
  }
}

// Общая обёртка над fetch: шлёт JSON и бросает ошибку, если сервер ответил не 2xx.
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`Запрос ${method} ${url} завершился ошибкой ${response.status}`)
  }

  return response.json()
}

// Бэкенд отдаёт карточки уже в нужном порядке: внутри колонки сверху самый крупный донат
// (а в «Выполнено» — последний выполненный), поэтому фронт ничего не сортирует.
export async function getCards(): Promise<Card[]> {
  const cards = await request<CardFromApi[]>('GET', '/api/cards')
  return cards.map(toCard)
}

export async function createCard(draft: CardDraft, columnId: number): Promise<Card> {
  const card = await request<CardFromApi>('POST', '/api/cards', { ...draft, column_id: columnId })
  return toCard(card)
}

export async function updateCard(id: number, draft: CardDraft): Promise<Card> {
  const card = await request<CardFromApi>('PATCH', `/api/cards/${id}`, draft)
  return toCard(card)
}

// Переносит карточку в другую колонку. Место в колонке бэкенд определит сам по сумме.
export async function moveCard(id: number, columnId: number): Promise<Card> {
  const card = await request<CardFromApi>('POST', `/api/cards/${id}/move`, { column_id: columnId })
  return toCard(card)
}

// Убирает карточку с доски в историю.
export async function removeCard(id: number): Promise<Card> {
  const card = await request<CardFromApi>('DELETE', `/api/cards/${id}`)
  return toCard(card)
}

// Кнопка «Очистить»: все карточки из «Выполнено» уходят в историю.
export async function clearDone(): Promise<void> {
  await request('POST', '/api/cards/clear-done')
}
