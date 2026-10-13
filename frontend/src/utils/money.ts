// Красивая запись суммы: 1500 RUB → «1 500 ₽», 5 USD → «5 $».

export function formatMoney(amount: number, currency: string | null) {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'RUB',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    // Браузер не знает такой код валюты — показываем как есть
    return `${amount} ${currency ?? ''}`.trim()
  }
}
