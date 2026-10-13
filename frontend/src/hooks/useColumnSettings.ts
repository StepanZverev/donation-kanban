// Настройка промежуточных колонок на странице «Настройки»:
// добавить, переименовать, удалить, переставить.

import { useCallback, useEffect, useState } from 'react'
import * as columnsApi from '../api/columns'
import type { BoardColumn } from '../types/card'
import { useBoardUpdates } from './useBoardUpdates'

// Столько же, сколько разрешает бэкенд (backend/app/routes/columns.py)
export const MIN_WORK_COLUMNS = 1
export const MAX_WORK_COLUMNS = 3

export function useColumnSettings() {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return columnsApi
      .getColumns()
      .then((freshColumns) => {
        setColumns(freshColumns)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить колонки. Проверь, что бэкенд запущен.'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Колонки могли поменять в другой вкладке
  useBoardUpdates(reload)

  // Только промежуточные колонки, слева направо. «Очередь» и «Выполнено» здесь не настраиваются.
  const workColumns = columns.filter((column) => column.kind === 'work')

  async function runAndReload(action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    await reload()
  }

  function addColumn(title: string) {
    return runAndReload(() => columnsApi.createColumn(title))
  }

  function renameColumn(id: number, title: string) {
    return runAndReload(() => columnsApi.renameColumn(id, title))
  }

  function removeColumn(id: number) {
    return runAndReload(() => columnsApi.deleteColumn(id))
  }

  // Сдвигает колонку на одно место влево (-1) или вправо (+1)
  function moveColumn(id: number, step: -1 | 1) {
    const ids = workColumns.map((column) => column.id)
    const from = ids.indexOf(id)
    const to = from + step
    if (to < 0 || to >= ids.length) {
      return
    }
    // Меняем колонку местами с соседней
    const neighbour = ids[to]
    ids[to] = ids[from]
    ids[from] = neighbour
    return runAndReload(() => columnsApi.reorderColumns(ids))
  }

  return { columns, workColumns, error, addColumn, renameColumn, removeColumn, moveColumn }
}
