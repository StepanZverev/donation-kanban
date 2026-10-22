import { EMPTY_MESSAGE_TITLE } from '../defaults'
import type { Card } from '../types/card'
import { formatMoney } from './money'

// Ник донатера для экрана. Нет ника — это аноним, и неважно,
// пришёл донат из DonationAlerts или карточку создали вручную.
export function getDonorName(card: Pick<Card, 'donorName'>) {
  return card.donorName || 'Аноним'
}

// Текст карточки. Короткий текст лежит в заголовке, а длинный — целиком в описании
// (в заголовке тогда только его начало), поэтому берём описание, а если его нет — заголовок.
export function getCardText(card: Pick<Card, 'title' | 'description'>) {
  return card.description || card.title
}

// Текст для поля «Текст» в форме: у доната без сообщения поле пустое
export function getEditableText(card: Card) {
  return card.title === EMPTY_MESSAGE_TITLE && !card.description ? '' : getCardText(card)
}

// Коротко о карточке: «Вася · 500 ₽» или просто «Вася», если суммы нет.
// Для плашки «Отменить» и окна «Отклонить».
export function describeCard(card: Card) {
  const name = getDonorName(card)
  return card.amount === null ? name : `${name} · ${formatMoney(card.amount, card.currency)}`
}
