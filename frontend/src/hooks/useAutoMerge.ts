// Галочка «Объединять донаты одного донатера автоматически» на странице «Настройки».

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as settingsApi from '../api/settings'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useAutoMerge() {
  const { id: boardId } = useBoard()
  const [isEnabled, setIsEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return settingsApi
      .getAutoMerge(boardId)
      .then((enabled) => {
        setIsEnabled(enabled)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить настройку. Проверь, что бэкенд запущен.'))
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Галочку могли переключить в другой вкладке
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  async function setAutoMerge(enabled: boolean) {
    // Сразу показываем новое состояние, не дожидаясь сервера
    setIsEnabled(enabled)
    try {
      await settingsApi.saveAutoMerge(boardId, enabled)
    } catch {
      setError('Не удалось сохранить настройку. Попробуй ещё раз.')
      await reload()
    }
  }

  return { isEnabled, error, setAutoMerge }
}
