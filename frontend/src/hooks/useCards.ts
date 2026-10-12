// Вся логика доски в одном месте: загрузка колонок и карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useState } from 'react'
import * as cardsApi from '../api/cards'
import * as columnsApi from '../api/columns'
import type { BoardColumn, Card, CardDraft } from '../types/card'
import { useBoardUpdates } from './useBoardUpdates'

export function useCards() {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Забирает актуальные колонки и карточки с сервера и кладёт их в состояние.
  const reload = useCallback(() => {
    return Promise.all([columnsApi.getColumns(), cardsApi.getCards()])
      .then(([freshColumns, freshCards]) => {
        setColumns(freshColumns)
        setCards(freshCards)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить доску. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [])

  // Первая загрузка при открытии страницы.
  useEffect(() => {
    reload()
  }, [reload])

  // Изменения от других вкладок и новые донаты.
  useBoardUpdates(reload)

  // После каждого изменения заново забираем карточки с сервера.
  // Так порядок в колонках всегда совпадает с тем, что посчитал бэкенд.
  async function runAndReload(action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    await reload()
  }

  function addCard(draft: CardDraft, columnId: number) {
    return runAndReload(() => cardsApi.createCard(draft, columnId))
  }

  function editCard(id: number, draft: CardDraft) {
    return runAndReload(() => cardsApi.updateCard(id, draft))
  }

  function moveCard(id: number, columnId: number) {
    return runAndReload(() => cardsApi.moveCard(id, columnId))
  }

  function removeCard(id: number) {
    return runAndReload(() => cardsApi.removeCard(id))
  }

  function clearDone() {
    return runAndReload(() => cardsApi.clearDone())
  }

  // Карточки одной колонки сверху вниз. Порядок уже задал бэкенд.
  function getColumnCards(columnId: number) {
    return cards.filter((card) => card.columnId === columnId)
  }

  return {
    isLoading,
    error,
    columns,
    getColumnCards,
    addCard,
    editCard,
    moveCard,
    removeCard,
    clearDone,
  }
}
