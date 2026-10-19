// «Показать на доске»: прокручивает страницу к карточке и ненадолго подсвечивает её.
// Карточку ищем по id элемента (см. getCardElementId).

import { useEffect, useState } from 'react'
import { getCardElementId } from '../utils/follow'

// Сколько миллисекунд карточка подсвечена
const FLASH_MS = 1600

export function useCardFlash() {
  const [flashedCardId, setFlashedCardId] = useState<number | null>(null)

  useEffect(() => {
    if (flashedCardId === null) {
      return
    }
    const timer = window.setTimeout(() => setFlashedCardId(null), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [flashedCardId])

  function showCard(cardId: number) {
    document.getElementById(getCardElementId(cardId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashedCardId(cardId)
  }

  return { flashedCardId, showCard }
}
