// Вся логика доски в одном месте: загрузка колонок и карточек и действия с ними.
// Компоненты получают отсюда готовые данные и функции и ничего не знают про API.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as cardsApi from '../api/cards'
import * as columnsApi from '../api/columns'
import * as historyApi from '../api/history'
import { MAX_UNDOABLE_ACTIONS } from '../defaults'
import type { BoardColumn, Card, CardDraft } from '../types/card'
import { describeCard } from '../utils/donor'
import { findSameDonorCards, isSameDonor } from '../utils/merging'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

// Как подписать плашку «Отменить» после того, как карточку убрали в историю
const archiveVerbs = {
  done: 'Выполнена',
  deleted: 'Удалена',
  rejected: 'Отклонена',
}

// Действие, которое можно отменить кнопкой «Отменить»:
// текст плашки и функция, которая откатывает действие.
export type UndoableAction = {
  id: number
  message: string
  undo: () => Promise<unknown>
}

export function useCards() {
  const { id: boardId } = useBoard()
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
    return Promise.all([columnsApi.getColumns(boardId), cardsApi.getCards(boardId)])
      .then(([freshColumns, freshCards]) => {
        setColumns(freshColumns)
        setCards(freshCards)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить доску. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [boardId])

  // Первая загрузка при открытии страницы.
  useEffect(() => {
    reload()
  }, [reload])

  // Изменения от других вкладок и новые донаты.
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  // Колонки «Очередь» и «Выполнено» — для кнопок «Очистить»
  const incomingColumn = columns.find((column) => column.kind === 'incoming')
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
    return runAndReload(() => cardsApi.createCard(boardId, draft, columnId))
  }

  function editCard(id: number, draft: CardDraft) {
    return runAndReload(() => cardsApi.updateCard(boardId, id, draft))
  }

  function moveCard(id: number, columnId: number) {
    return runAndReload(() => cardsApi.moveCard(boardId, id, columnId))
  }

  // Сразу в историю как «выполнено», «удалено» или «отклонено»: зоны по краям доски,
  // крайние стрелки на карточке, «Удалить» и «Отклонить» в меню.
  // note — причина отказа, нужна только для «отклонено».
  function archiveCard(cardId: number, reason: 'done' | 'deleted' | 'rejected', note = '') {
    const card = cards.find((boardCard) => boardCard.id === cardId)
    if (!card) {
      return
    }
    rememberRestore(`${archiveVerbs[reason]}: ${describeCard(card)}`, [card], card.columnId)
    return runAndReload(() => cardsApi.archiveCard(boardId, card.id, reason, note))
  }

  // Другие карточки того же донатера, которые можно слить в эту
  function getMergeableCards(card: Card) {
    return findSameDonorCards(card, cards)
  }

  // Можно ли бросить карточку draggedId на card, чтобы объединить их
  function canMergeOnDrop(draggedId: number, card: Card) {
    const draggedCard = cards.find((boardCard) => boardCard.id === draggedId)
    return draggedCard !== undefined && draggedCard.id !== card.id && isSameDonor(draggedCard, card)
  }

  // Сливает cardsToMerge в target. Слитые карточки уходят в историю,
  // «Отменить» вернёт их на доску — бэкенд при этом вычтет их суммы и тексты.
  function mergeCards(target: Card, cardsToMerge: Card[], message: string) {
    const cardIds = cardsToMerge.map((card) => card.id)
    rememberAction(message, () => cardsApi.unmergeCards(boardId, target.id, cardIds))
    return runAndReload(() => cardsApi.mergeCards(boardId, target.id, cardIds))
  }

  // «Объединить все донаты в эту карточку» в меню «⋯»
  function mergeAllInto(target: Card) {
    const cardsToMerge = getMergeableCards(target)
    return mergeCards(target, cardsToMerge, `Объединено донатов: ${cardsToMerge.length + 1} · ${target.donorName}`)
  }

  // Карточку draggedId бросили на target
  function mergeOnDrop(draggedId: number, target: Card) {
    const draggedCard = cards.find((card) => card.id === draggedId)
    if (draggedCard && canMergeOnDrop(draggedId, target)) {
      return mergeCards(target, [draggedCard], `Объединена: ${describeCard(draggedCard)}`)
    }
  }

  // «Разъединить» в меню «⋯»: все слитые в карточку донаты возвращаются на доску.
  // «Отменить» сольёт их обратно.
  function unmergeCard(target: Card) {
    return runAndReload(async () => {
      const restoredCards = await cardsApi.unmergeCards(boardId, target.id, null)
      const cardIds = restoredCards.map((card) => card.id)
      rememberAction(`Разъединено: ${target.donorName}`, () => cardsApi.mergeCards(boardId, target.id, cardIds))
    })
  }

  // «Очистить» — все выполненные в историю.
  function clearDone() {
    if (doneColumn) {
      const doneCards = getColumnCards(doneColumn.id)
      rememberRestore(`Очищено выполненных: ${doneCards.length}`, doneCards, doneColumn.id)
    }
    return runAndReload(() => cardsApi.clearDone(boardId))
  }

  // «Очистить очередь» — все карточки из «Очереди» в историю как удалённые.
  function clearQueue() {
    if (incomingColumn) {
      const queueCards = getColumnCards(incomingColumn.id)
      rememberRestore(`Очищена очередь: ${queueCards.length}`, queueCards, incomingColumn.id)
    }
    return runAndReload(() => cardsApi.clearQueue(boardId))
  }

  // Кладёт действие в стопку для «Отменить». undo — как его откатить.
  function rememberAction(message: string, undo: () => Promise<unknown>) {
    const action: UndoableAction = { id: nextActionId.current, message, undo }
    nextActionId.current += 1
    setUndoableActions((actions) => [...actions, action].slice(-MAX_UNDOABLE_ACTIONS))
  }

  // Действие, которое отменяется возвратом карточек из истории в колонку columnId
  function rememberRestore(message: string, actionCards: Card[], columnId: number | null) {
    if (columnId === null) {
      return
    }
    const cardIds = actionCards.map((card) => card.id)
    rememberAction(message, () => Promise.all(cardIds.map((id) => historyApi.restoreCard(boardId, id, columnId))))
  }

  // «Отменить» у конкретного действия
  function undoAction(action: UndoableAction) {
    forgetAction(action.id)
    return runAndReload(action.undo)
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
    getMergeableCards,
    canMergeOnDrop,
    mergeAllInto,
    mergeOnDrop,
    unmergeCard,
    clearDone,
    clearQueue,
    undoableActions,
    undoAction,
    forgetAction,
  }
}
