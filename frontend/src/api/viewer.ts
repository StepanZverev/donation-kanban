// Запросы к API страницы для зрителей (backend/app/routes/viewer.py):
// настройки «Для зрителей» у стримера и сама доска для зрителя.

import type { BoardColumn, PublicCard } from '../types/card'
import type { PriorityLevel } from '../utils/priority'

export type ViewerSettings = {
  // Секретная часть ссылки для зрителей (/v/<токен>). null — ссылка выключена.
  publicToken: string | null
  // Ссылка на страницу доната. Пустая строка — кнопки «+» у зрителей нет.
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

export async function getViewerSettings(): Promise<ViewerSettings> {
  return readViewerSettings(await fetch('/api/settings/viewer'))
}

export async function saveDonationUrl(url: string): Promise<ViewerSettings> {
  const response = await fetch('/api/settings/viewer/donation-url', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return readViewerSettings(response)
}

// Включает ссылку для зрителей или делает новую (старая перестаёт работать)
export async function createPublicLink(): Promise<ViewerSettings> {
  return readViewerSettings(await fetch('/api/settings/viewer/link', { method: 'POST' }))
}

export async function deletePublicLink(): Promise<ViewerSettings> {
  return readViewerSettings(await fetch('/api/settings/viewer/link', { method: 'DELETE' }))
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
  // Имя стримера из DonationAlerts, null — без имени
  streamerName: string | null
  columns: BoardColumn[]
  cards: PublicCard[]
  priorityLevels: PriorityLevel[]
  donationUrl: string
  intakeOpen: boolean
}

type PublicBoardFromApi = {
  streamer_name: string | null
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
  }
}
