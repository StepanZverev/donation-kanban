// Настройки приёма донатов: открыт ли приём, минимальная сумма, анонимы, свои правила.
// Нужны и странице «Настройки», и переключателю в меню аккаунта.

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as settingsApi from '../api/settings'
import type { IntakeSettings } from '../api/settings'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useIntakeSettings() {
  const { id: boardId } = useBoard()
  // null — ещё не загрузили
  const [settings, setSettings] = useState<IntakeSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return settingsApi
      .getIntakeSettings(boardId)
      .then((loaded) => {
        setSettings(loaded)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить настройки. Проверь, что бэкенд запущен.'))
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Настройки могли поменять в другой вкладке или переключателем в меню аккаунта
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

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
      await settingsApi.saveIntakeSettings(boardId, updated)
    } catch {
      // Сначала возвращаем то, что на самом деле сохранено, потом показываем ошибку:
      // удачная загрузка сама стирает прошлую ошибку
      await reload()
      setError('Не удалось сохранить настройку. Попробуй ещё раз.')
    }
  }

  return { settings, error, changeIntake }
}
