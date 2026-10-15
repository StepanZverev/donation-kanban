// Доска по id из адреса: есть ли к ней доступ, чья она и кто на ней пользователь.

import { useEffect, useState } from 'react'
import * as boardsApi from '../api/boards'
import type { BoardInfo } from '../api/boards'

// loading — ещё грузим, ready — доска есть, missing — доски нет или доступа к ней нет
type BoardInfoState =
  | { status: 'loading' }
  | { status: 'ready'; board: BoardInfo }
  | { status: 'missing' }
  | { status: 'error' }

export function useBoardInfo(boardId: number) {
  // Ответ запоминаем вместе с id доски: открыли другую доску — старый ответ не годится
  const [loaded, setLoaded] = useState<{ boardId: number; state: BoardInfoState } | null>(null)

  useEffect(() => {
    boardsApi
      .getBoard(boardId)
      .then((board) => setLoaded({ boardId, state: board ? { status: 'ready', board } : { status: 'missing' } }))
      .catch(() => setLoaded({ boardId, state: { status: 'error' } }))
  }, [boardId])

  if (loaded === null || loaded.boardId !== boardId) {
    return { status: 'loading' } as const
  }
  return loaded.state
}
