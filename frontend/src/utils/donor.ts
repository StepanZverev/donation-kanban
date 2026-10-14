import type { Card } from '../types/card'

// Ник донатера для экрана. Анонимный донат приходит без ника — пишем «Аноним».
export function getDonorName(card: Card) {
  return card.donorName || 'Аноним'
}
