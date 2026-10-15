// Какая доска сейчас открыта: её id и кто на ней пользователь (хозяин или модератор).
//
// Доску выбирает адрес /boards/<id>/... (см. App.tsx): там BoardContext.Provider
// кладёт сюда доску, а хуки и компоненты внутри берут её через useBoard().
// Так не нужно передавать id доски через пропсы каждого компонента.

import { createContext, useContext } from 'react'
import type { BoardInfo } from '../api/boards'

export const BoardContext = createContext<BoardInfo | null>(null)

export function useBoard(): BoardInfo {
  const board = useContext(BoardContext)
  if (board === null) {
    throw new Error('useBoard() работает только внутри открытой доски (/boards/<id>)')
  }
  return board
}
