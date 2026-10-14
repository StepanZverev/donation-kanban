// Группировка истории по дням: по сути, один день — один стрим.

import type { Card } from '../types/card'

export type HistoryDay = {
  // Ключ дня вида '2026-10-14' — для key в React
  key: string
  // Подпись: «Сегодня, 14 октября», «Вчера, 13 октября», «12 октября»
  label: string
  cards: Card[]
  // Сколько в этом дне донатов и на какую сумму (в валюте стримера)
  donationCount: number
  total: number
}

// Раскладывает карточки по дням, в которые их убрали с доски.
// Карточки уже идут от новых к старым, поэтому и дни получаются от новых к старым.
export function groupByDay(cards: Card[], now: Date): HistoryDay[] {
  const days: HistoryDay[] = []

  for (const card of cards) {
    // archivedAt у карточек в истории есть всегда
    const date = new Date(card.archivedAt ?? card.updatedAt)
    const key = getDayKey(date)
    let day = days.at(-1)
    if (!day || day.key !== key) {
      day = { key, label: formatDayLabel(date, now), cards: [], donationCount: 0, total: 0 }
      days.push(day)
    }

    day.cards.push(card)
    // Ручные карточки считаем наравне с донатами
    day.donationCount += 1
    // Сумму слитой карточки уже включила в себя та, в которую её слили, — не считаем дважды
    if (card.archiveReason !== 'merged') {
      day.total += card.streamerAmount ?? 0
    }
  }

  return days
}

// Дата в часовом поясе пользователя → '2026-10-14'
function getDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatDayLabel(date: Date, now: Date) {
  // «14 октября», а для прошлых лет — «14 октября 2025 г.»
  const dayAndMonth = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (getDayKey(date) === getDayKey(now)) {
    return `Сегодня, ${dayAndMonth}`
  }
  if (getDayKey(date) === getDayKey(yesterday)) {
    return `Вчера, ${dayAndMonth}`
  }
  return dayAndMonth
}
