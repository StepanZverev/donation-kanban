// Какие карточки можно объединить. То же правило, что на бэкенде (backend/app/merging.py):
// любые карточки на доске с одинаковым ником донатера, в какой бы колонке они ни были.
// Ник без учёта регистра: «Вася» = «вася». Карточки без ника (анонимы) не объединяем.

import type { Card } from '../types/card'
import { isSameDonorName } from './donor'

export function isSameDonor(card: Card, other: Card) {
  return isSameDonorName(card.donorName, other.donorName)
}

// Другие карточки того же донатера, которые можно слить в card
export function findSameDonorCards(card: Card, cards: Card[]) {
  return cards.filter((other) => other.id !== card.id && isSameDonor(card, other))
}
