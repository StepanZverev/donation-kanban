// Выбор темы оформления на странице «Настройки».
// Сервер тут не участвует: тема хранится в браузере (см. utils/theme.ts).

import { useState } from 'react'
import { getSavedThemeMode, saveThemeMode, type ThemeMode } from '../utils/theme'

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(getSavedThemeMode)

  function changeMode(newMode: ThemeMode) {
    saveThemeMode(newMode)
    setMode(newMode)
  }

  return { mode, changeMode }
}
