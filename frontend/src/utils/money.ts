// Красивая запись суммы: 1500 RUB → «1 500 ₽», 5 USD → «5 $».

import { STREAMER_CURRENCY } from '../defaults'

export function formatMoney(amount: number, currency: string | null) {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || STREAMER_CURRENCY,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    // Браузер не знает такой код валюты — показываем как есть
    return `${amount} ${currency ?? ''}`.trim()
  }
}

// Значок валюты для подписи у поля суммы: RUB → «₽», USD → «$»
export function getCurrencySymbol(currency: string | null) {
  const parts = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: currency || STREAMER_CURRENCY }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency ?? '₽'
}
