// Сумма за стрим в шапке и сброс доски.

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as streamApi from '../api/stream'
import type { StreamTotal } from '../api/stream'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useStreamTotal() {
  const { id: boardId } = useBoard()
  // null — ещё не загрузили (или бэкенд не отвечает)
  const [streamTotal, setStreamTotal] = useState<StreamTotal | null>(null)

  const reload = useCallback(() => {
    streamApi
      .getStreamTotal(boardId)
      .then(setStreamTotal)
      // Бэкенд не отвечает — об этом и так скажет доска, сумму просто не покажем
      .catch(() => {})
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Пришёл донат, карточку объединили или сбросили доску в другой вкладке
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  async function resetBoard() {
    try {
      setStreamTotal(await streamApi.resetBoard(boardId))
    } catch {
      window.alert('Не удалось сбросить доску. Проверь, что бэкенд запущен.')
    }
  }

  return { streamTotal, resetBoard }
}
