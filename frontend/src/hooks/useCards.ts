// Вся логика доски в одном месте: загрузка колонок и карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useState } from 'react'
import * as cardsApi from '../api/cards'
import * as columnsApi from '../api/columns'
import * as historyApi from '../api/history'
import type { BoardColumn, Card, CardDraft } from '../types/card'
import { useBoardUpdates } from './useBoardUpdates'

// Последнее действие, которое можно отменить кнопкой «Отменить»:
// какие карточки вернуть из истории и в какую колонку.
export type UndoableAction = {
  message: string
  cardIds: number[]
  columnId: number
}

export function useCards() {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<UndoableAction | null>(null)

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

  // Колонки особого вида. Промежуточных может быть несколько, «В работу» кладём в первую.
  const firstWorkColumn = columns.find((column) => column.kind === 'work')
  const doneColumn = columns.find((column) => column.kind === 'done')

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

  // ▶ — взять в работу (в первую промежуточную колонку).
  function startCard(card: Card) {
    if (firstWorkColumn) {
      return moveCard(card.id, firstWorkColumn.id)
    }
  }

  // ✓ — выполнено.
  function completeCard(card: Card) {
    if (doneColumn) {
      return moveCard(card.id, doneColumn.id)
    }
  }

  // ✕ — выкинуть в историю. Запоминаем колонку, чтобы «Отменить» вернул карточку туда же.
  function removeCard(card: Card) {
    if (card.columnId !== null) {
      setLastAction({ message: 'Карточка выкинута', cardIds: [card.id], columnId: card.columnId })
    }
    return runAndReload(() => cardsApi.removeCard(card.id))
  }

  // «Очистить» — все выполненные в историю.
  function clearDone() {
    if (doneColumn) {
      const cardIds = getColumnCards(doneColumn.id).map((card) => card.id)
      setLastAction({ message: `Убрано в историю: ${cardIds.length}`, cardIds, columnId: doneColumn.id })
    }
    return runAndReload(() => cardsApi.clearDone())
  }

  // «Отменить» — возвращаем карточки из истории туда, где они были.
  function undoLastAction() {
    if (!lastAction) {
      return
    }
    const { cardIds, columnId } = lastAction
    setLastAction(null)
    return runAndReload(() =>
      Promise.all(cardIds.map((id) => historyApi.restoreCard(id, columnId))),
    )
  }

  // useCallback — чтобы функция не менялась при каждой перерисовке:
  // иначе таймер плашки «Отменить» перезапускался бы при каждом обновлении доски.
  const forgetLastAction = useCallback(() => setLastAction(null), [])

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
    startCard,
    completeCard,
    removeCard,
    clearDone,
    lastAction,
    undoLastAction,
    forgetLastAction,
  }
}
