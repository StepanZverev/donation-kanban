// Подсказки ников под полем «Ник»: ищем, пока человек печатает.
// Запрос уходит не на каждую букву, а когда он остановился на DEBOUNCE_MS.

import { useEffect, useState } from 'react'
import { getDonorSuggestions } from '../api/donors'
import { useBoard } from './useBoard'

const DEBOUNCE_MS = 200

export function useDonorSuggestions(query: string) {
  const { id: boardId } = useBoard()
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    // Ответ на старый запрос может прийти позже нового — такой выкидываем
    let isCurrent = true
    const timer = window.setTimeout(() => {
      getDonorSuggestions(boardId, query)
        .then((names) => {
          if (isCurrent) {
            setSuggestions(names)
          }
        })
        // Нет подсказок — ничего страшного, ник можно вписать руками
        .catch(() => {})
    }, DEBOUNCE_MS)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [boardId, query])

  return suggestions
}
