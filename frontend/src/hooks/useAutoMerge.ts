// Галочка «Объединять донаты одного донатера автоматически» на странице «Настройки».

import * as settingsApi from '../api/settings'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useAutoMerge() {
  const { id: boardId } = useBoard()
  const {
    data: isEnabled,
    setData: setIsEnabled,
    error,
    save,
  } = useBoardData(settingsApi.getAutoMerge, false, 'Не удалось загрузить настройку. Проверь, что бэкенд запущен.')

  function setAutoMerge(enabled: boolean) {
    // Сразу показываем новое состояние, не дожидаясь сервера
    setIsEnabled(enabled)
    return save(() => settingsApi.saveAutoMerge(boardId, enabled), 'Не удалось сохранить настройку. Попробуй ещё раз.')
  }

  return { isEnabled, error, setAutoMerge }
}
