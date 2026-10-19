// Уровни приоритета карточек: загрузка с сервера и сохранение.
// Нужны и доске (цвет обводки карточек), и странице «Настройки».

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as settingsApi from '../api/settings'
import { DEFAULT_PRIORITY_LEVELS, type PriorityLevel } from '../utils/priority'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function usePriorityLevels() {
  const { id: boardId } = useBoard()
  // Пока уровни не загрузились, красим карточки цветами по умолчанию
  const [levels, setLevels] = useState<PriorityLevel[]>(DEFAULT_PRIORITY_LEVELS)

  const reload = useCallback(() => {
    // Не загрузилось — оставляем то, что было: карточки всё равно раскрашены
    return settingsApi
      .getPriorityLevels(boardId)
      .then(setLevels)
      .catch(() => {})
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Уровни могли поменять в другой вкладке
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  // Ошибку не ловим: её покажет страница настроек рядом с кнопкой «Сохранить»
  async function saveLevels(newLevels: PriorityLevel[]) {
    const saved = await settingsApi.savePriorityLevels(boardId, newLevels)
    setLevels(saved)
  }

  return { levels, saveLevels }
}
