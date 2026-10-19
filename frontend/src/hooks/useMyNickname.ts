// Как модератор представился на открытой доске, и смена этого имени.
// Стример видит это имя в списке модераторов, а сам модератор — на кнопке меню в шапке.

import { useState } from 'react'
import * as boardsApi from '../api/boards'
import { useBoard } from './useBoard'

export function useMyNickname() {
  const board = useBoard()
  // Сохранённое имя. Сначала берём то, что пришло вместе с доской, потом — ответ сервера.
  const [nickname, setNickname] = useState(board.myNickname)
  const [error, setError] = useState<string | null>(null)

  // Возвращает true, если сохранилось
  async function saveNickname(newNickname: string) {
    try {
      const updated = await boardsApi.changeMyNickname(board.id, newNickname.trim())
      setNickname(updated.myNickname)
      setError(null)
      return true
    } catch {
      setError('Не удалось сохранить имя. Попробуй ещё раз.')
      return false
    }
  }

  return { nickname, error, saveNickname }
}
