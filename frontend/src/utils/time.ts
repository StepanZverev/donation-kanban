// Подписи вида «только что», «3 мин назад», «2 ч назад» и склонение слов по числу.

import { JUST_NOW_SECONDS } from '../defaults'

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

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Первые секунды пишем «только что»
const JUST_NOW = JUST_NOW_SECONDS * 1000

// Сколько прошло от времени isoTime до now, коротко и с точностью до самой крупной единицы:
// «только что», «меньше минуты», «3 мин назад», «2 ч назад», «5 дней назад».
export function formatTimeAgo(isoTime: string, now: number) {
  const age = getAge(isoTime, now)

  if (age < JUST_NOW) {
    return 'только что'
  }
  if (age < MINUTE) {
    return 'меньше минуты'
  }
  if (age < HOUR) {
    return `${Math.floor(age / MINUTE)} мин назад`
  }
  if (age < DAY) {
    return `${Math.floor(age / HOUR)} ч назад`
  }
  const days = Math.floor(age / DAY)
  return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} назад`
}

// Через сколько миллисекунд подпись formatTimeAgo сменится: «только что» — через 10 секунд,
// дальше — когда наберётся следующая целая минута, час или день.
export function getTimeAgoChangeDelay(isoTime: string, now: number) {
  const age = getAge(isoTime, now)

  if (age < JUST_NOW) {
    return JUST_NOW - age
  }
  const step = age < HOUR ? MINUTE : age < DAY ? HOUR : DAY
  return step - (age % step)
}

// Сколько миллисекунд прошло; время из будущего (часы разошлись) считаем за «только что»
function getAge(isoTime: string, now: number) {
  return Math.max(0, now - new Date(isoTime).getTime())
}
