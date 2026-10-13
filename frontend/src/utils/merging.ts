// Какие карточки можно объединить. То же правило, что на бэкенде (backend/app/merging.py):
// любые карточки на доске с одинаковым ником донатера, в какой бы колонке они ни были.
// Ник без учёта регистра: «Вася» = «вася». У ручных карточек ника нет — их не объединяем.

import type { Card } from '../types/card'

export function isSameDonor(card: Card, other: Card) {
  if (!card.donorName || !other.donorName) {
    return false
  }
  return card.donorName.toLowerCase() === other.donorName.toLowerCase()
}

// Другие карточки того же донатера, которые можно слить в card
export function findSameDonorCards(card: Card, cards: Card[]) {
  return cards.filter((other) => other.id !== card.id && isSameDonor(card, other))
}
