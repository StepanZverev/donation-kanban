// Запросы к API карточек. Компоненты не вызывают fetch напрямую,
// а пользуются функциями отсюда.

import type { Card, CardDraft, CardStatus } from '../types/card'

// Бэкенд пишет поля в snake_case (donor_name), а во фронте принят camelCase (donorName).
// Описываем, в каком виде карточка приходит с сервера, и переводим её в наш тип.
type CardFromApi = {
  id: number
  title: string
  description: string
  status: CardStatus
  position: number
  source: Card['source']
  donation_id: number | null
  donor_name: string | null
  amount: number | null
  currency: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archive_reason: Card['archiveReason']
}

function toCard(card: CardFromApi): Card {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    status: card.status,
    position: card.position,
    source: card.source,
    donationId: card.donation_id,
    donorName: card.donor_name,
    amount: card.amount,
    currency: card.currency,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
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

export async function getCards(): Promise<Card[]> {
  const cards = await request<CardFromApi[]>('GET', '/api/cards')
  return cards.map(toCard)
}

export async function createCard(draft: CardDraft, status: CardStatus): Promise<Card> {
  const card = await request<CardFromApi>('POST', '/api/cards', { ...draft, status })
  return toCard(card)
}

export async function updateCard(id: number, draft: CardDraft): Promise<Card> {
  const card = await request<CardFromApi>('PATCH', `/api/cards/${id}`, draft)
  return toCard(card)
}

export async function moveCard(id: number, status: CardStatus, position: number): Promise<Card> {
  const card = await request<CardFromApi>('POST', `/api/cards/${id}/move`, { status, position })
  return toCard(card)
}

// Убирает карточку с доски в историю.
export async function removeCard(id: number): Promise<Card> {
  const card = await request<CardFromApi>('DELETE', `/api/cards/${id}`)
  return toCard(card)
}
