// Настройки приёма донатов: открыт ли приём, минимальная сумма, анонимы, свои правила.
// Нужны и странице «Настройки», и переключателю в меню аккаунта.

import * as settingsApi from '../api/settings'
import type { IntakeSettings } from '../api/settings'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useIntakeSettings() {
  const { id: boardId } = useBoard()
  // settings: null — ещё не загрузили
  const {
    data: settings,
    setData: setSettings,
    error,
    save,
  } = useBoardData<IntakeSettings | null>(
    settingsApi.getIntakeSettings,
    null,
    'Не удалось загрузить настройки. Проверь, что бэкенд запущен.',
  )

  // Меняет одну или несколько настроек, остальные оставляет как были:
  // changeIntake({ isOpen: false })
  function changeIntake(changes: Partial<IntakeSettings>) {
    if (!settings) {
      return
    }
    const updated = { ...settings, ...changes }
    // Сразу показываем новое состояние, не дожидаясь сервера
    setSettings(updated)
    return save(
      () => settingsApi.saveIntakeSettings(boardId, updated),
      'Не удалось сохранить настройку. Попробуй ещё раз.',
    )
  }

  return { settings, error, changeIntake }
}
