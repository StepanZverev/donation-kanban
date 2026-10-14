import type { Card } from '../types/card'

// Заголовок доната без сообщения (backend/app/board.py, EMPTY_MESSAGE_TITLE)
const EMPTY_MESSAGE_TITLE = 'Донат без сообщения'

// Есть ли у карточки донатер: у доната есть всегда (пусть и аноним),
// у ручной — если стример вписал ник.
export function hasDonor(card: Card) {
  return card.source === 'donationalerts' || Boolean(card.donorName)
}

// Ник донатера для экрана. Анонимный донат приходит без ника — пишем «Аноним».
export function getDonorName(card: Card) {
  return card.donorName || 'Аноним'
}

// Текст карточки. Короткий текст лежит в заголовке, а длинный — целиком в описании
// (в заголовке тогда только его начало), поэтому берём описание, а если его нет — заголовок.
export function getCardText(card: Card) {
  return card.description || card.title
}

// Текст для поля «Текст» в форме: у доната без сообщения поле пустое
export function getEditableText(card: Card) {
  return card.title === EMPTY_MESSAGE_TITLE && !card.description ? '' : getCardText(card)
}
