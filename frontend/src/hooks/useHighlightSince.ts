// Подсветка новых донатов, когда заходишь на вкладку (см. useNewDonations).
//
// seenAt — до какого времени донаты уже видели. Запоминаем его, когда страница
// открылась, и через GLOW_SECONDS забываем: подсветка мигнула и погасла.
// Пока подсветка горит, возвращает время, донаты новее которого подсвечиваются,
// потом — null.

import { useEffect, useState } from 'react'
import { GLOW_SECONDS } from '../defaults'

export function useHighlightSince(seenAt: string | null) {
  // useState запоминает значение только при первой отрисовке страницы
  const [highlightSince, setHighlightSince] = useState(seenAt)

  useEffect(() => {
    const timer = window.setTimeout(() => setHighlightSince(null), GLOW_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [])

  return highlightSince
}
