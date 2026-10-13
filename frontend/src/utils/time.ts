// Подписи вида «40 сек назад», «3 мин назад», «1 ч 10 мин назад» и склонение слов по числу.

// Выбирает форму слова для числа: 1 донат, 2 доната, 5 донатов.
// forms — [для 1, для 2–4, для 5–20]. Отдельно учитываем 11–14: «11 донатов», а не «11 донат».
export function pluralize(count: number, forms: [string, string, string]) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return forms[2]
  }
  if (lastDigit === 1) {
    return forms[0]
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1]
  }
  return forms[2]
}

// Сколько прошло от времени isoTime до now, коротко: «только что», «40 сек назад»,
// «3 мин назад», «1 ч 10 мин назад», «2 ч назад».
export function formatTimeAgo(isoTime: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(isoTime).getTime()) / 1000))

  if (seconds < 10) {
    return 'только что'
  }
  if (seconds < 60) {
    return `${seconds} сек назад`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} мин назад`
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (restMinutes === 0) {
    return `${hours} ч назад`
  }
  return `${hours} ч ${restMinutes} мин назад`
}
