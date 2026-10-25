// Уровни приоритета карточек: загрузка с сервера и сохранение.
// Нужны и доске (цвет обводки карточек), и странице «Настройки».

import * as settingsApi from '../api/settings'
import { DEFAULT_PRIORITY_LEVELS } from '../defaults'
import type { PriorityLevel } from '../utils/priority'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function usePriorityLevels() {
  const { id: boardId } = useBoard()
  // Пока уровни не загрузились, красим карточки цветами по умолчанию.
  // Не загрузилось — оставляем то, что было, и молчим: карточки всё равно раскрашены.
  const { data: levels, setData: setLevels } = useBoardData<PriorityLevel[]>(
    settingsApi.getPriorityLevels,
    DEFAULT_PRIORITY_LEVELS,
    null,
  )

  // Ошибку не ловим: её покажет страница настроек рядом с кнопкой «Сохранить»
  async function saveLevels(newLevels: PriorityLevel[]) {
    const saved = await settingsApi.savePriorityLevels(boardId, newLevels)
    setLevels(saved)
  }

  return { levels, saveLevels }
}
