// Логика вкладки «История»: загрузка списка с фильтром и поиском и действия с ним.

import { useCallback, useEffect, useState } from 'react'
import * as historyApi from '../api/history'
import type { HistoryFilter } from '../api/history'
import { HISTORY_SEARCH_DELAY_MS } from '../defaults'
import type { Card } from '../types/card'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useHistoryCards() {
  const { id: boardId } = useBoard()
  // Выбранная пометка и текст в поле поиска — как их видит человек
  const [reason, setReason] = useState<HistoryFilter['reason']>(null)
  const [query, setQuery] = useState('')
  // Текст поиска, по которому реально ищем: догоняет query с задержкой
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), HISTORY_SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  // Загрузка с выбранным фильтром и поиском. Поменялись они — useBoardData загрузит заново.
  const loadHistory = useCallback(
    (forBoardId: number) => historyApi.getHistory(forBoardId, { reason, query: searchQuery }),
    [reason, searchQuery],
  )
  const { data: cards, isLoading, error, save } = useBoardData<Card[]>(
    loadHistory,
    [],
    'Не удалось загрузить историю. Проверь, что бэкенд запущен.',
  )

  function restoreCard(id: number) {
    return save(() => historyApi.restoreCard(boardId, id))
  }

  function deleteForever(id: number) {
    return save(() => historyApi.deleteForever(boardId, id))
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
