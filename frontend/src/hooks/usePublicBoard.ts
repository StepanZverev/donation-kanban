// Доска для зрителя по ссылке /v/<токен>: загрузка и живые обновления.

import { useCallback, useEffect, useState } from 'react'
import * as viewerApi from '../api/viewer'
import type { PublicBoard } from '../api/viewer'
import { useBoardUpdates } from './useBoardUpdates'

// loading — ещё грузим, ready — доска есть, broken — ссылка не работает
type PublicBoardState =
  | { status: 'loading' }
  | { status: 'ready'; board: PublicBoard }
  | { status: 'broken' }

export function usePublicBoard(token: string) {
  const [state, setState] = useState<PublicBoardState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return viewerApi
      .getPublicBoard(token)
      .then((board) => {
        setState(board ? { status: 'ready', board } : { status: 'broken' })
        setError(null)
      })
      // Сервер не ответил — оставляем то, что уже показано, и пишем об ошибке
      .catch(() => setError('Не удалось обновить доску. Попробуй обновить страницу.'))
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  // Стример что-то поменял на доске — перечитываем её
  useBoardUpdates(reload, viewerApi.getPublicUpdatesPath(token))

  // Колонку берём отдельно: бэкенд уже отдаёт карточки в нужном порядке
  function getColumnCards(columnId: number) {
    if (state.status !== 'ready') {
      return []
    }
    return state.board.cards.filter((card) => card.columnId === columnId)
  }

  return { state, error, getColumnCards }
}
