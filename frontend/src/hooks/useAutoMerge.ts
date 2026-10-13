// Галочка «Объединять донаты одного донатера автоматически» на странице «Настройки».

import { useCallback, useEffect, useState } from 'react'
import * as settingsApi from '../api/settings'
import { useBoardUpdates } from './useBoardUpdates'

export function useAutoMerge() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return settingsApi
      .getAutoMerge()
      .then((enabled) => {
        setIsEnabled(enabled)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить настройку. Проверь, что бэкенд запущен.'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Галочку могли переключить в другой вкладке
  useBoardUpdates(reload)

  async function setAutoMerge(enabled: boolean) {
    // Сразу показываем новое состояние, не дожидаясь сервера
    setIsEnabled(enabled)
    try {
      await settingsApi.saveAutoMerge(enabled)
    } catch {
      setError('Не удалось сохранить настройку. Попробуй ещё раз.')
      await reload()
    }
  }

  return { isEnabled, error, setAutoMerge }
}
