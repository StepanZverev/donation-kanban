// Сумма за стрим в шапке и сброс доски.

import { useCallback, useEffect, useState } from 'react'
import * as streamApi from '../api/stream'
import type { StreamTotal } from '../api/stream'
import { useBoardUpdates } from './useBoardUpdates'

export function useStreamTotal() {
  // null — ещё не загрузили (или бэкенд не отвечает)
  const [streamTotal, setStreamTotal] = useState<StreamTotal | null>(null)

  const reload = useCallback(() => {
    streamApi
      .getStreamTotal()
      .then(setStreamTotal)
      // Бэкенд не отвечает — об этом и так скажет доска, сумму просто не покажем
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Пришёл донат, карточку объединили или сбросили доску в другой вкладке
  useBoardUpdates(reload)

  async function resetBoard() {
    try {
      setStreamTotal(await streamApi.resetBoard())
    } catch {
      window.alert('Не удалось сбросить доску. Проверь, что бэкенд запущен.')
    }
  }

  return { streamTotal, resetBoard }
}
