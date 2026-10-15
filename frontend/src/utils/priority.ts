// Уровни приоритета карточки: чем больше донат, тем заметнее карточка.
// Уровень задаётся нижней границей суммы (в валюте стримера),
// верхняя граница — начало следующего уровня.
// Стример меняет уровни на странице «Настройки», а здесь значения по умолчанию
// (такие же, как на бэкенде) — ими красим карточки, пока настройки не загрузились.

export type PriorityLevel = {
  minAmount: number
  name: string
  color: string
}

export const DEFAULT_PRIORITY_LEVELS: PriorityLevel[] = [
  { minAmount: 0, name: 'Низкий', color: '#85839a' }, // серый
  { minAmount: 100, name: 'Средний', color: '#3f9a68' }, // зелёный
  { minAmount: 500, name: 'Высокий', color: '#b8902f' }, // золотой
  { minAmount: 1000, name: 'Топ', color: '#c9545d' }, // красный
]

// Находит уровень для суммы: самый «высокий» уровень, до нижней границы которого сумма дотянулась.
// Уровни должны идти по возрастанию minAmount.
export function getPriorityLevel(amount: number, levels: PriorityLevel[]) {
  let result = levels[0]
  for (const level of levels) {
    if (amount >= level.minAmount) {
      result = level
    }
  }
  return result
}
