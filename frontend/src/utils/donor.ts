import type { Card } from '../types/card'

// Есть ли у карточки донатер: у доната есть всегда (пусть и аноним),
// у ручной — если стример вписал ник.
export function hasDonor(card: Card) {
  return card.source === 'donationalerts' || Boolean(card.donorName)
}

// Ник донатера для экрана. Анонимный донат приходит без ника — пишем «Аноним».
export function getDonorName(card: Card) {
  return card.donorName || 'Аноним'
}

// Текст карточки под ником (если ника нет — под заголовком):
// - у доната заголовок — обрезанное начало сообщения, а целиком оно в описании,
//   поэтому показываем описание, а если его нет — заголовок;
// - у ручной карточки с ником заголовок уходит в текст, ведь сверху стоит ник;
// - у ручной карточки без ника заголовок стоит сверху, а текст — это описание.
export function getCardText(card: Card) {
  if (card.source === 'donationalerts') {
    return card.description || card.title
  }
  if (card.donorName) {
    return card.description ? `${card.title}\n${card.description}` : card.title
  }
  return card.description
}
