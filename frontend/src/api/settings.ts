// Запросы к API настроек: уровни приоритета карточек, автообъединение и приём донатов.

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

export async function getPriorityLevels(boardId: number): Promise<PriorityLevel[]> {
  const response = await fetch(`/api/boards/${boardId}/settings/priority-levels`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить уровни: ${response.status}`)
  }
  const levels: PriorityLevelFromApi[] = await response.json()
  return levels.map(toPriorityLevel)
}

// Сохраняет все уровни сразу. Если бэкенд не согласен (например, нет уровня от 0),
// в ошибке будет его объяснение — его можно показать пользователю.
export async function savePriorityLevels(boardId: number, levels: PriorityLevel[]): Promise<PriorityLevel[]> {
  const response = await fetch(`/api/boards/${boardId}/settings/priority-levels`, {
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

// Галочка «Объединять донаты одного донатера автоматически»
export async function getAutoMerge(boardId: number): Promise<boolean> {
  const response = await fetch(`/api/boards/${boardId}/settings/auto-merge`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить настройку: ${response.status}`)
  }
  const body: { enabled: boolean } = await response.json()
  return body.enabled
}

export async function saveAutoMerge(boardId: number, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/settings/auto-merge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) {
    throw new Error(`Не удалось сохранить настройку: ${response.status}`)
  }
}

// Раздел «Приём донатов»: какие донаты становятся карточками (backend/app/intake.py)
export type IntakeSettings = {
  // Принимать заказы. Выключено — донаты сразу уходят в историю с пометкой «приём закрыт».
  isOpen: boolean
  // Донаты меньше этой суммы на доску не попадают. 0 — без минимума.
  minAmount: number
  // Донаты без ника на доску не попадают
  ignoreAnonymous: boolean
  // Свои правила доната текстом, их видят зрители в «Как заказать». Пустая строка — правил нет.
  rules: string
}

type IntakeSettingsFromApi = {
  open: boolean
  min_amount: number
  ignore_anonymous: boolean
  rules: string
}

export async function getIntakeSettings(boardId: number): Promise<IntakeSettings> {
  const response = await fetch(`/api/boards/${boardId}/settings/intake`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить настройки приёма: ${response.status}`)
  }
  const body: IntakeSettingsFromApi = await response.json()
  return {
    isOpen: body.open,
    minAmount: body.min_amount,
    ignoreAnonymous: body.ignore_anonymous,
    rules: body.rules,
  }
}

// Сохраняет настройки приёма целиком
export async function saveIntakeSettings(boardId: number, settings: IntakeSettings): Promise<void> {
  const body: IntakeSettingsFromApi = {
    open: settings.isOpen,
    min_amount: settings.minAmount,
    ignore_anonymous: settings.ignoreAnonymous,
    rules: settings.rules,
  }
  const response = await fetch(`/api/boards/${boardId}/settings/intake`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Не удалось сохранить настройки приёма: ${response.status}`)
  }
}
