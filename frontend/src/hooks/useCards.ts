// Вся логика доски в одном месте: загрузка карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useState } from 'react'
import * as cardsApi from '../api/cards'
import type { Card, CardDraft, CardStatus } from '../types/card'

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Забирает актуальные карточки с сервера и кладёт их в состояние.
  const reload = useCallback(() => {
    return cardsApi
      .getCards()
      .then((freshCards) => {
        setCards(freshCards)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить карточки. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [])

  // Первая загрузка при открытии страницы.
  useEffect(() => {
    reload()
  }, [reload])

  // После каждого изменения заново забираем карточки с сервера.
  // Так позиции в колонках всегда совпадают с тем, что в базе.
  async function runAndReload(action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    await reload()
  }

  function addCard(draft: CardDraft, status: CardStatus) {
    return runAndReload(() => cardsApi.createCard(draft, status))
  }

  function editCard(id: number, draft: CardDraft) {
    return runAndReload(() => cardsApi.updateCard(id, draft))
  }

  function moveCard(id: number, status: CardStatus, position: number) {
    return runAndReload(() => cardsApi.moveCard(id, status, position))
  }

  function removeCard(id: number) {
    return runAndReload(() => cardsApi.removeCard(id))
  }

  // Карточки одной колонки сверху вниз.
  function getColumnCards(status: CardStatus) {
    return cards
      .filter((card) => card.status === status)
      .sort((a, b) => a.position - b.position)
  }

  return { isLoading, error, getColumnCards, addCard, editCard, moveCard, removeCard }
}
