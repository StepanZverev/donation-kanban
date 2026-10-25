// Настройка промежуточных колонок на странице «Настройки»:
// добавить, переименовать, удалить, переставить.

import * as columnsApi from '../api/columns'
import type { BoardColumn } from '../types/card'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useColumnSettings() {
  const { id: boardId } = useBoard()
  const { data: columns, error, save } = useBoardData<BoardColumn[]>(
    columnsApi.getColumns,
    [],
    'Не удалось загрузить колонки. Проверь, что бэкенд запущен.',
  )

  // Только промежуточные колонки, слева направо. «Очередь» и «Выполнено» здесь не настраиваются.
  const workColumns = columns.filter((column) => column.kind === 'work')

  function addColumn(title: string) {
    return save(() => columnsApi.createColumn(boardId, title))
  }

  function renameColumn(id: number, title: string) {
    return save(() => columnsApi.renameColumn(boardId, id, title))
  }

  function removeColumn(id: number) {
    return save(() => columnsApi.deleteColumn(boardId, id))
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
    return save(() => columnsApi.reorderColumns(boardId, ids))
  }

  return { columns, workColumns, error, addColumn, renameColumn, removeColumn, moveColumn }
}
