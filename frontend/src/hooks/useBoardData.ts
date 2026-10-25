// Данные открытой доски с сервера: загружаются при открытии и заново, когда доска
// поменялась (пришёл донат, кто-то что-то поправил в другой вкладке, см. useBoardUpdates).
// На этом помощнике стоят хуки доски: карточки, колонки, настройки, сумма за стрим и т. д.
//
//   const { data: columns, error, save } = useBoardData(columnsApi.getColumns, [], 'Не удалось загрузить колонки.')
//
// load — функция из src/api/, которая получает id доски и возвращает данные.
//   Если ей нужно что-то ещё (например, фильтр истории), оберни её в useCallback:
//   новая функция на каждой отрисовке запускала бы загрузку по кругу.
// initialData — что показывать, пока не загрузили.
// loadError — что написать, если загрузить не вышло. null — ничего не писать
//   (например, у суммы за стрим: что бэкенд не отвечает, и так скажет доска).

import { useCallback, useEffect, useState } from 'react'
import { getBoardUpdatesPath } from '../api/boards'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useBoardData<T>(load: (boardId: number) => Promise<T>, initialData: T, loadError: string | null) {
  const { id: boardId } = useBoard()
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return load(boardId)
      .then((loaded) => {
        setData(loaded)
        setError(null)
      })
      .catch(() => {
        // Не загрузилось — оставляем то, что уже показано
        if (loadError) {
          setError(loadError)
        }
      })
      .finally(() => setIsLoading(false))
  }, [load, boardId, loadError])

  // Первая загрузка, а если поменялась сама загрузка (например, фильтр истории) — заново
  useEffect(() => {
    reload()
  }, [reload])

  // Доска поменялась на сервере — перечитываем
  useBoardUpdates(reload, getBoardUpdatesPath(boardId))

  // Отправляет изменение на сервер и перечитывает данные: так порядок и суммы на экране
  // всегда такие, как посчитал бэкенд. Возвращает, удалось ли сохранить.
  // saveError — что написать, если сохранить не вышло.
  async function save(action: () => Promise<unknown>, saveError = 'Не удалось сохранить изменения. Попробуй ещё раз.') {
    let isSaved = true
    try {
      await action()
    } catch {
      isSaved = false
    }
    await reload()
    // Ошибку показываем после перезагрузки: удачная загрузка сама стирает прошлую ошибку
    if (!isSaved) {
      setError(saveError)
    }
    return isSaved
  }

  return { data, setData, isLoading, error, setError, reload, save }
}
