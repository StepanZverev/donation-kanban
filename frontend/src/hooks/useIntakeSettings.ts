// Настройки приёма донатов: открыт ли приём, минимальная сумма, анонимы.
// Нужны и странице «Настройки», и переключателю в шапке.

import { useCallback, useEffect, useState } from 'react'
import * as settingsApi from '../api/settings'
import type { IntakeSettings } from '../api/settings'
import { useBoardUpdates } from './useBoardUpdates'

export function useIntakeSettings() {
  // null — ещё не загрузили
  const [settings, setSettings] = useState<IntakeSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return settingsApi
      .getIntakeSettings()
      .then((loaded) => {
        setSettings(loaded)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить настройки. Проверь, что бэкенд запущен.'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Настройки могли поменять в другой вкладке или переключателем в шапке
  useBoardUpdates(reload)

  // Меняет одну или несколько настроек, остальные оставляет как были:
  // changeIntake({ isOpen: false })
  async function changeIntake(changes: Partial<IntakeSettings>) {
    if (!settings) {
      return
    }
    const updated = { ...settings, ...changes }
    // Сразу показываем новое состояние, не дожидаясь сервера
    setSettings(updated)
    try {
      await settingsApi.saveIntakeSettings(updated)
    } catch {
      setError('Не удалось сохранить настройку. Попробуй ещё раз.')
      await reload()
    }
  }

  return { settings, error, changeIntake }
}
