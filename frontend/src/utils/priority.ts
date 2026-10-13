// Уровни приоритета карточки: чем больше донат, тем заметнее карточка.
// Уровень задаётся нижней границей суммы (в валюте стримера),
// верхняя граница — начало следующего уровня.
// Пока это значения по умолчанию, позже их можно будет менять на странице «Настройки».

export type PriorityLevel = {
  minAmount: number
  name: string
  color: string
}

export const DEFAULT_PRIORITY_LEVELS: PriorityLevel[] = [
  { minAmount: 0, name: 'Низкий', color: '#afb8c1' },
  { minAmount: 100, name: 'Средний', color: '#d4a72c' },
  { minAmount: 500, name: 'Высокий', color: '#cf222e' },
]

// Находит уровень для суммы: самый «высокий» уровень, до нижней границы которого сумма дотянулась.
// Уровни должны идти по возрастанию minAmount.
export function getPriorityLevel(amount: number, levels = DEFAULT_PRIORITY_LEVELS) {
  let result = levels[0]
  for (const level of levels) {
    if (amount >= level.minAmount) {
      result = level
    }
  }
  return result
}
