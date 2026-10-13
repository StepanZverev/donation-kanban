// Запросы к API настроек: уровни приоритета карточек.

import type { PriorityLevel } from '../utils/priority'

// В каком виде уровень приходит с сервера (snake_case)
type PriorityLevelFromApi = {
  min_amount: number
  name: string
  color: string
}

function toPriorityLevel(level: PriorityLevelFromApi): PriorityLevel {
  return { minAmount: level.min_amount, name: level.name, color: level.color }
}

function toApi(level: PriorityLevel): PriorityLevelFromApi {
  return { min_amount: level.minAmount, name: level.name, color: level.color }
}

export async function getPriorityLevels(): Promise<PriorityLevel[]> {
  const response = await fetch('/api/settings/priority-levels')
  if (!response.ok) {
    throw new Error(`Не удалось загрузить уровни: ${response.status}`)
  }
  const levels: PriorityLevelFromApi[] = await response.json()
  return levels.map(toPriorityLevel)
}

// Сохраняет все уровни сразу. Если бэкенд не согласен (например, нет уровня от 0),
// в ошибке будет его объяснение — его можно показать пользователю.
export async function savePriorityLevels(levels: PriorityLevel[]): Promise<PriorityLevel[]> {
  const response = await fetch('/api/settings/priority-levels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(levels.map(toApi)),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const reason = typeof body?.detail === 'string' ? body.detail : 'проверь суммы, названия и цвета'
    throw new Error(`Не удалось сохранить: ${reason}`)
  }
  const saved: PriorityLevelFromApi[] = await response.json()
  return saved.map(toPriorityLevel)
}
