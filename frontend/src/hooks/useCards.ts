// Вся логика доски в одном месте: загрузка колонок и карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as cardsApi from '../api/cards'
import * as columnsApi from '../api/columns'
import * as historyApi from '../api/history'
import type { BoardColumn, Card, CardDraft } from '../types/card'
import { useBoardUpdates } from './useBoardUpdates'

// Действие, которое можно отменить кнопкой «Отменить»:
// какие карточки вернуть из истории и в какую колонку.
export type UndoableAction = {
  id: number
  message: string
  cardIds: number[]
  columnId: number
}

// Сколько последних действий можно отменить. Более старые просто забываются.
const MAX_UNDOABLE_ACTIONS = 5

export function useCards() {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Стопка действий для «Отменить», самое новое — последнее.
  // Хранится только в браузере: после перезагрузки страницы стопка пустая.
  const [undoableActions, setUndoableActions] = useState<UndoableAction[]>([])
  // Счётчик для id действий. useRef — потому что его изменение не должно перерисовывать страницу.
  const nextActionId = useRef(1)

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
    rememberAction(`Выкинута: ${describeCard(card)}`, [card], card.columnId)
    return runAndReload(() => cardsApi.removeCard(card.id))
  }

  // Перетащили в зону по краю доски: сразу в историю как «выполнено» или «удалено».
  function archiveCard(cardId: number, reason: 'done' | 'deleted') {
    const card = cards.find((boardCard) => boardCard.id === cardId)
    if (!card) {
      return
    }
    const verb = reason === 'done' ? 'Выполнена' : 'Удалена'
    rememberAction(`${verb}: ${describeCard(card)}`, [card], card.columnId)
    return runAndReload(() => cardsApi.archiveCard(card.id, reason))
  }

  // «Очистить» — все выполненные в историю.
  function clearDone() {
    if (doneColumn) {
      const doneCards = getColumnCards(doneColumn.id)
      rememberAction(`Очищено выполненных: ${doneCards.length}`, doneCards, doneColumn.id)
    }
    return runAndReload(() => cardsApi.clearDone())
  }

  // Кладёт действие в стопку для «Отменить».
  function rememberAction(message: string, actionCards: Card[], columnId: number | null) {
    if (columnId === null) {
      return
    }
    const action: UndoableAction = {
      id: nextActionId.current,
      message,
      cardIds: actionCards.map((card) => card.id),
      columnId,
    }
    nextActionId.current += 1
    setUndoableActions((actions) => [...actions, action].slice(-MAX_UNDOABLE_ACTIONS))
  }

  // «Отменить» у конкретного действия — возвращаем его карточки из истории туда, где они были.
  function undoAction(action: UndoableAction) {
    forgetAction(action.id)
    return runAndReload(() =>
      Promise.all(action.cardIds.map((id) => historyApi.restoreCard(id, action.columnId))),
    )
  }

  // Убирает действие из стопки (плашка закрылась сама или его отменили).
  // useCallback — чтобы функция не менялась при каждой перерисовке:
  // иначе таймеры плашек перезапускались бы при каждом обновлении доски.
  const forgetAction = useCallback((actionId: number) => {
    setUndoableActions((actions) => actions.filter((action) => action.id !== actionId))
  }, [])

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
    archiveCard,
    clearDone,
    undoableActions,
    undoAction,
    forgetAction,
  }
}

// Короткое описание карточки для плашки «Отменить»: чтобы было понятно, что именно отменяешь.
function describeCard(card: Card) {
  if (card.donorName) {
    return `${card.donorName} · ${card.amount} ${card.currency}`
  }
  const maxLength = 40
  return card.title.length > maxLength ? `«${card.title.slice(0, maxLength)}…»` : `«${card.title}»`
}
