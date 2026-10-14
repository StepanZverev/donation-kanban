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
  archive_note: string | null
  merge_count: number
  merged_into_id: number | null
  last_donation_at?: string | null
  last_merged_at?: string | null
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
    archiveNote: card.archive_note,
    mergeCount: card.merge_count,
    mergedIntoId: card.merged_into_id,
    lastDonationAt: card.last_donation_at ?? null,
    lastMergedAt: card.last_merged_at ?? null,
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

// Форма → то, что ждёт бэкенд (snake_case). Пустой ник отправляем как null — «без ника».
function draftToApi(draft: CardDraft) {
  return {
    donor_name: draft.donorName || null,
    text: draft.text,
    amount: draft.amount,
  }
}

export async function createCard(draft: CardDraft, columnId: number): Promise<Card> {
  const card = await request<CardFromApi>('POST', '/api/cards', { ...draftToApi(draft), column_id: columnId })
  return toCard(card)
}

export async function updateCard(id: number, draft: CardDraft): Promise<Card> {
  const card = await request<CardFromApi>('PATCH', `/api/cards/${id}`, draftToApi(draft))
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

// Убирает карточку в историю с явной пометкой — так работают зоны по краям доски
// и «Отклонить» в меню. note — причина отказа (нужна только для 'rejected').
export async function archiveCard(
  id: number,
  reason: 'done' | 'deleted' | 'rejected',
  note = '',
): Promise<Card> {
  const card = await request<CardFromApi>('POST', `/api/cards/${id}/archive`, { reason, note })
  return toCard(card)
}

// Сливает карточки cardIds в карточку targetId (все — от одного донатера).
// Возвращает карточку targetId после слияния.
export async function mergeCards(targetId: number, cardIds: number[]): Promise<Card> {
  const card = await request<CardFromApi>('POST', `/api/cards/${targetId}/merge`, { card_ids: cardIds })
  return toCard(card)
}

// «Разъединить»: слитые в targetId карточки возвращаются на доску, туда, где были.
// cardIds — только эти (для «Отменить» после объединения), null — все.
export async function unmergeCards(targetId: number, cardIds: number[] | null): Promise<Card[]> {
  const cards = await request<CardFromApi[]>('POST', `/api/cards/${targetId}/unmerge`, {
    card_ids: cardIds,
  })
  return cards.map(toCard)
}

// Кнопка «Очистить»: все карточки из «Выполнено» уходят в историю.
export async function clearDone(): Promise<void> {
  await request('POST', '/api/cards/clear-done')
}

// Кнопка «Очистить очередь»: все карточки из «Очереди» уходят в историю как удалённые.
export async function clearQueue(): Promise<void> {
  await request('POST', '/api/cards/clear-queue')
}

// Когда пришли самые свежие донаты (null — таких ещё не было). По ним в навигации
// ставится точка «есть новое» у вкладок «Доска» и «История».
export type LatestDonations = {
  // Самый свежий донат, который попал на доску
  onBoard: string | null
  // Самый свежий донат, который сразу ушёл в историю (отсеян настройками приёма)
  toHistory: string | null
}

export async function getLatestDonations(): Promise<LatestDonations> {
  const response = await fetch('/api/cards/latest-donations')
  if (!response.ok) {
    throw new Error(`Не удалось узнать о новых донатах: ${response.status}`)
  }
  const body: { on_board: string | null; to_history: string | null } = await response.json()
  return { onBoard: body.on_board, toHistory: body.to_history }
}
