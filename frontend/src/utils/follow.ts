// Где карточки ника, за которым следит зритель (плашка FollowPanel на странице зрителя).

import type { PublicBoard } from '../api/viewer'
import type { BoardColumn, PublicCard } from '../types/card'
import { isSameDonorName } from './donor'

// Карточка ника в «Очереди» и её место (1 — самая верхняя)
export type QueuePlace = {
  card: PublicCard
  place: number
}

// Что показать в плашке:
// work — карточка в промежуточной колонке (например, «В работе»);
// queue — карточки в «Очереди» с местами;
// done — карточка уже в «Выполнено»;
// none — карточек этого ника на доске нет.
export type FollowState =
  | { kind: 'work'; card: PublicCard; column: BoardColumn }
  | { kind: 'queue'; places: QueuePlace[]; queueSize: number; topCard: PublicCard }
  | { kind: 'done'; card: PublicCard }
  | { kind: 'none' }

// Тот же ли это ник. Без учёта регистра, как при слиянии (utils/merging.ts)
export function isFollowedDonor(card: PublicCard, followedName: string) {
  return isSameDonorName(card.donorName, followedName)
}

// getColumnCards отдаёт карточки колонки в том порядке, в каком они на доске сверху вниз
export function getFollowState(
  board: PublicBoard,
  followedName: string,
  getColumnCards: (columnId: number) => PublicCard[],
): FollowState {
  // Сначала промежуточные колонки: задачу уже делают, это важнее места в очереди
  for (const column of board.columns.filter((column) => column.kind === 'work')) {
    const card = getColumnCards(column.id).find((card) => isFollowedDonor(card, followedName))
    if (card) {
      return { kind: 'work', card, column }
    }
  }

  const queue = board.columns.find((column) => column.kind === 'incoming')
  const queueCards = queue ? getColumnCards(queue.id) : []
  const places = queueCards
    .map((card, index) => ({ card, place: index + 1 }))
    .filter((item) => isFollowedDonor(item.card, followedName))
  if (places.length > 0) {
    return { kind: 'queue', places, queueSize: queueCards.length, topCard: queueCards[0] }
  }

  const done = board.columns.find((column) => column.kind === 'done')
  const doneCard = done ? getColumnCards(done.id).find((card) => isFollowedDonor(card, followedName)) : undefined
  if (doneCard) {
    return { kind: 'done', card: doneCard }
  }

  return { kind: 'none' }
}

// Сколько добавить к карточке, чтобы она встала выше верхней.
// При равной сумме выше та, что пришла раньше, поэтому нужно строго больше.
// Целыми: «+701 ₽», а не «+700,01 ₽».
export function getAmountToTop(card: PublicCard, topCard: PublicCard) {
  return Math.floor((topCard.streamerAmount ?? 0) - (card.streamerAmount ?? 0)) + 1
}

// id элемента карточки на странице — по нему «Показать на доске» находит карточку
export function getCardElementId(cardId: number) {
  return `card-${cardId}`
}
