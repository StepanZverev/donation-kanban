// Уровни приоритета карточки: чем больше донат, тем заметнее карточка.
// Уровень задаётся нижней границей суммы (в валюте стримера),
// верхняя граница — начало следующего уровня.
// Стример меняет уровни на странице «Настройки», а уровни по умолчанию — в src/defaults.ts.

export type PriorityLevel = {
  minAmount: number
  name: string
  color: string
}

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
