// Запросы к API страницы для зрителей (backend/app/routes/viewer.py):
// настройки «Для зрителей» у стримера и сама доска для зрителя.

import type { BoardColumn, PublicCard } from '../types/card'
import type { PriorityLevel } from '../utils/priority'

export type ViewerSettings = {
  // Секретная часть ссылки для зрителей (/v/<токен>). null — ссылка выключена.
  publicToken: string | null
  // Ссылка на страницу доната. Пустая строка — кнопки «Предложить задачу» у зрителей нет.
  donationUrl: string
}

type ViewerSettingsFromApi = {
  public_token: string | null
  donation_url: string
}

function toViewerSettings(settings: ViewerSettingsFromApi): ViewerSettings {
  return { publicToken: settings.public_token, donationUrl: settings.donation_url }
}

// Общая обработка ответа настроек: ошибку бэкенда (например, «нужна ссылка на DonationAlerts»)
// кладём в текст ошибки, чтобы показать её пользователю.
async function readViewerSettings(response: Response): Promise<ViewerSettings> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const reason = typeof body?.detail === 'string' ? body.detail : `ошибка ${response.status}`
    throw new Error(reason)
  }
  return toViewerSettings(await response.json())
}

export async function getViewerSettings(boardId: number): Promise<ViewerSettings> {
  return readViewerSettings(await fetch(`/api/boards/${boardId}/settings/viewer`))
}

export async function saveDonationUrl(boardId: number, url: string): Promise<ViewerSettings> {
  const response = await fetch(`/api/boards/${boardId}/settings/viewer/donation-url`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return readViewerSettings(response)
}

// Включает ссылку для зрителей или делает новую (старая перестаёт работать)
export async function createPublicLink(boardId: number): Promise<ViewerSettings> {
  return readViewerSettings(await fetch(`/api/boards/${boardId}/settings/viewer/link`, { method: 'POST' }))
}

export async function deletePublicLink(boardId: number): Promise<ViewerSettings> {
  return readViewerSettings(await fetch(`/api/boards/${boardId}/settings/viewer/link`, { method: 'DELETE' }))
}

// Полный адрес страницы для зрителей, его стример копирует и выкладывает
export function getPublicPageUrl(token: string) {
  return `${window.location.origin}/v/${token}`
}

// Адрес живых обновлений для зрителя (см. useBoardUpdates)
export function getPublicUpdatesPath(token: string) {
  return `/api/public/boards/${token}/ws`
}

export type PublicBoard = {
  // Имя и аватарка стримера из DonationAlerts, null — без имени (гость)
  streamerName: string | null
  streamerAvatarUrl: string | null
  // Открыта ли у стримера его доска прямо сейчас — «Стример на месте»
  streamerOnline: boolean
  // Когда стример последний раз был на сайте — для «был 2 ч назад»
  streamerLastSeenAt: string
  columns: BoardColumn[]
  cards: PublicCard[]
  priorityLevels: PriorityLevel[]
  donationUrl: string
  // Правила приёма — из них собирается блок «Как заказать»
  intakeOpen: boolean
  // Минимальная сумма доната, 0 — без минимума
  minAmount: number
  // Донаты без ника на доску не попадают
  ignoreAnonymous: boolean
  // Несколько донатов одного зрителя складываются в одну карточку
  autoMerge: boolean
  // Свои правила доната от стримера. Пустая строка — правил нет.
  rules: string
  // Подключён ли у стримера DonationAlerts: без него донат не станет карточкой
  donationsConnected: boolean
}

type PublicBoardFromApi = {
  streamer_name: string | null
  streamer_avatar_url: string | null
  streamer_online: boolean
  streamer_last_seen_at: string
  columns: BoardColumn[]
  cards: {
    id: number
    title: string
    description: string
    column_id: number | null
    donor_name: string | null
    amount: number | null
    currency: string | null
    streamer_amount: number | null
    merge_count: number
  }[]
  priority_levels: { min_amount: number; name: string; color: string }[]
  donation_url: string
  intake_open: boolean
  min_amount: number
  ignore_anonymous: boolean
  auto_merge: boolean
  rules: string
  donations_connected: boolean
}

// Доска для зрителя. null — ссылка не работает (неверная или стример её выключил).
export async function getPublicBoard(token: string): Promise<PublicBoard | null> {
  const response = await fetch(`/api/public/boards/${encodeURIComponent(token)}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить доску: ${response.status}`)
  }
  const board: PublicBoardFromApi = await response.json()
  return {
    streamerName: board.streamer_name,
    streamerAvatarUrl: board.streamer_avatar_url,
    streamerOnline: board.streamer_online,
    streamerLastSeenAt: board.streamer_last_seen_at,
    columns: board.columns,
    cards: board.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      columnId: card.column_id,
      donorName: card.donor_name,
      amount: card.amount,
      currency: card.currency,
      streamerAmount: card.streamer_amount,
      mergeCount: card.merge_count,
    })),
    priorityLevels: board.priority_levels.map((level) => ({
      minAmount: level.min_amount,
      name: level.name,
      color: level.color,
    })),
    donationUrl: board.donation_url,
    intakeOpen: board.intake_open,
    minAmount: board.min_amount,
    ignoreAnonymous: board.ignore_anonymous,
    autoMerge: board.auto_merge,
    rules: board.rules,
    donationsConnected: board.donations_connected,
  }
}
