// Логика вкладки «История»: загрузка списка и действия с ним.

import { useCallback, useEffect, useState } from 'react'
import * as historyApi from '../api/history'
import type { Card } from '../types/card'

export function useHistoryCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return historyApi
      .getHistory()
      .then((freshCards) => {
        setCards(freshCards)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить историю. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function runAndReload(action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    await reload()
  }

  function restoreCard(id: number) {
    return runAndReload(() => historyApi.restoreCard(id))
  }

  function deleteForever(id: number) {
    return runAndReload(() => historyApi.deleteForever(id))
  }

  return { cards, isLoading, error, restoreCard, deleteForever }
}
