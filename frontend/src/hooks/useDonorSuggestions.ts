// Подсказки ников под полем «Ник»: ищем, пока человек печатает.
// Запрос уходит не на каждую букву, а когда человек перестал печатать
// (задержка DONOR_SUGGESTIONS_DELAY_MS в src/defaults.ts).

import { useEffect, useState } from 'react'
import { getDonorSuggestions } from '../api/donors'
import { DONOR_SUGGESTIONS_DELAY_MS } from '../defaults'
import { useBoard } from './useBoard'

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
    }, DONOR_SUGGESTIONS_DELAY_MS)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [boardId, query])

  return suggestions
}
