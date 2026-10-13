// Вся логика доски в одном месте: загрузка колонок и карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as cardsApi from '../api/cards'
import * as columnsApi from '../api/columns'
import * as historyApi from '../api/history'
import type { BoardColumn, Card, CardDraft } from '../types/card'
import { findMergeTarget } from '../utils/merging'
import { formatMoney } from '../utils/money'
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

  // Колонка «Выполнено» — для кнопки «Очистить»
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

  // Сразу в историю как «выполнено» или «удалено»: зоны по краям доски,
  // крайние стрелки на карточке и «Удалить» в меню.
  function archiveCard(cardId: number, reason: 'done' | 'deleted') {
    const card = cards.find((boardCard) => boardCard.id === cardId)
    if (!card) {
      return
    }
    const verb = reason === 'done' ? 'Выполнена' : 'Удалена'
    rememberAction(`${verb}: ${describeCard(card)}`, [card], card.columnId)
    return runAndReload(() => cardsApi.archiveCard(card.id, reason))
  }

  // Есть ли у карточки «пара» того же донатера, с которой её можно объединить
  function canMerge(card: Card) {
    return findMergeTarget(card, cards, columns) !== null
  }

  // Какую карточку объединить, если бросить карточку draggedId на overCard. null — эти две не объединяются.
  // Тащить можно в обе стороны: новую на старую и старую на новую. В историю всё равно
  // уйдёт та, что сливается в другую по правилу (findMergeTarget), — как и через меню.
  function getMergeOnDrop(draggedId: number, overCard: Card) {
    const draggedCard = cards.find((card) => card.id === draggedId)
    if (!draggedCard) {
      return null
    }
    if (findMergeTarget(draggedCard, cards, columns)?.id === overCard.id) {
      return draggedCard
    }
    if (findMergeTarget(overCard, cards, columns)?.id === draggedCard.id) {
      return overCard
    }
    return null
  }

  // «Объединить»: карточка сливается в основную карточку донатера, а сама уходит в историю.
  // «Отменить» вернёт её из истории в ту же колонку — бэкенд при этом вычтет её сумму и текст.
  function mergeCard(card: Card) {
    rememberAction(`Объединена: ${describeCard(card)}`, [card], card.columnId)
    return runAndReload(() => cardsApi.mergeCard(card.id))
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
    archiveCard,
    canMerge,
    getMergeOnDrop,
    mergeCard,
    clearDone,
    undoableActions,
    undoAction,
    forgetAction,
  }
}

// Короткое описание карточки для плашки «Отменить»: чтобы было понятно, что именно отменяешь.
function describeCard(card: Card) {
  if (card.donorName && card.amount !== null) {
    return `${card.donorName} · ${formatMoney(card.amount, card.currency)}`
  }
  const maxLength = 40
  return card.title.length > maxLength ? `«${card.title.slice(0, maxLength)}…»` : `«${card.title}»`
}
