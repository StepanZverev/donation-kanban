// Запросы к API настроек: уровни приоритета карточек, автообъединение и приём донатов.

import type { PriorityLevel } from '../utils/priority'
import { request } from './request'

// В каком виде уровень приходит с сервера (snake_case)
export type PriorityLevelFromApi = {
  min_amount: number
  name: string
  color: string
}

export function toPriorityLevel(level: PriorityLevelFromApi): PriorityLevel {
  return { minAmount: level.min_amount, name: level.name, color: level.color }
}

function toApi(level: PriorityLevel): PriorityLevelFromApi {
  return { min_amount: level.minAmount, name: level.name, color: level.color }
}

export async function getPriorityLevels(boardId: number): Promise<PriorityLevel[]> {
  const levels = await request<PriorityLevelFromApi[]>('GET', `/api/boards/${boardId}/settings/priority-levels`)
  return levels.map(toPriorityLevel)
}

// Сохраняет все уровни сразу. Если бэкенд не согласен (например, нет уровня от 0),
// в ошибке будет его объяснение (см. getErrorDetail в api/request.ts).
export async function savePriorityLevels(boardId: number, levels: PriorityLevel[]): Promise<PriorityLevel[]> {
  const saved = await request<PriorityLevelFromApi[]>(
    'PUT',
    `/api/boards/${boardId}/settings/priority-levels`,
    levels.map(toApi),
  )
  return saved.map(toPriorityLevel)
}

// Галочка «Объединять донаты одного донатера автоматически»
export async function getAutoMerge(boardId: number): Promise<boolean> {
  const body = await request<{ enabled: boolean }>('GET', `/api/boards/${boardId}/settings/auto-merge`)
  return body.enabled
}

export async function saveAutoMerge(boardId: number, enabled: boolean): Promise<void> {
  await request('PUT', `/api/boards/${boardId}/settings/auto-merge`, { enabled })
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
  const body = await request<IntakeSettingsFromApi>('GET', `/api/boards/${boardId}/settings/intake`)
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
  await request('PUT', `/api/boards/${boardId}/settings/intake`, body)
}
