// Настройка промежуточных колонок на странице «Настройки»:
// добавить, переименовать, удалить, переставить.

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import * as columnsApi from '../api/columns'
import type { BoardColumn } from '../types/card'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useColumnSettings() {
  const { id: boardId } = useBoard()
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return columnsApi
      .getColumns(boardId)
      .then((freshColumns) => {
        setColumns(freshColumns)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить колонки. Проверь, что бэкенд запущен.'))
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Колонки могли поменять в другой вкладке
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  // Только промежуточные колонки, слева направо. «Очередь» и «Выполнено» здесь не настраиваются.
  const workColumns = columns.filter((column) => column.kind === 'work')

  // Возвращает, удалось ли действие.
  async function runAndReload(action: () => Promise<unknown>) {
    let isSaved = true
    try {
      await action()
    } catch {
      isSaved = false
    }
    await reload()
    // Ошибку показываем после перезагрузки: удачная загрузка сама стирает прошлую ошибку
    if (!isSaved) {
      setError('Не удалось сохранить изменения. Попробуй ещё раз.')
    }
    return isSaved
  }

  function addColumn(title: string) {
    return runAndReload(() => columnsApi.createColumn(boardId, title))
  }

  function renameColumn(id: number, title: string) {
    return runAndReload(() => columnsApi.renameColumn(boardId, id, title))
  }

  function removeColumn(id: number) {
    return runAndReload(() => columnsApi.deleteColumn(boardId, id))
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
    return runAndReload(() => columnsApi.reorderColumns(boardId, ids))
  }

  return { columns, workColumns, error, addColumn, renameColumn, removeColumn, moveColumn }
}
