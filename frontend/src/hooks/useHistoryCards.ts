// Логика вкладки «История»: загрузка списка с фильтром и поиском и действия с ним.

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as historyApi from '../api/history'
import type { HistoryFilter } from '../api/history'
import { HISTORY_SEARCH_DELAY_MS } from '../defaults'
import type { Card } from '../types/card'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useHistoryCards() {
  const { id: boardId } = useBoard()
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Выбранная пометка и текст в поле поиска — как их видит человек
  const [reason, setReason] = useState<HistoryFilter['reason']>(null)
  const [query, setQuery] = useState('')
  // Текст поиска, по которому реально ищем: догоняет query с задержкой
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), HISTORY_SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const reload = useCallback(() => {
    return historyApi
      .getHistory(boardId, { reason, query: searchQuery })
      .then((freshCards) => {
        setCards(freshCards)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить историю. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [boardId, reason, searchQuery])

  // Загружаем при открытии и заново при каждой смене фильтра или поиска
  useEffect(() => {
    reload()
  }, [reload])

  // Карточку могли убрать в историю или переоткрыть в другой вкладке.
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  async function runAndReload(action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    await reload()
  }

  function restoreCard(id: number) {
    return runAndReload(() => historyApi.restoreCard(boardId, id))
  }

  function deleteForever(id: number) {
    return runAndReload(() => historyApi.deleteForever(boardId, id))
  }

  return {
    cards,
    isLoading,
    error,
    reason,
    setReason,
    query,
    setQuery,
    // Включён ли фильтр или поиск — чтобы различать «история пуста» и «ничего не нашлось»
    isFiltered: reason !== null || searchQuery.trim() !== '',
    restoreCard,
    deleteForever,
  }
}
