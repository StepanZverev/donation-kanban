// Свёрнут ли блок «Как заказать» на странице зрителя.
// Зритель, который уже выучил правила, может свернуть блок в одну строку.
// Выбор хранится в браузере (localStorage), один на все доски: свернул раз — запомнилось.

import { useState } from 'react'
import { readSaved, save } from '../utils/storage'

const STORAGE_KEY = 'viewer-rules-collapsed'

export function useRulesCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(() => readSaved(STORAGE_KEY) === 'on')

  function toggleCollapsed() {
    save(STORAGE_KEY, isCollapsed ? null : 'on')
    setIsCollapsed(!isCollapsed)
  }

  return { isCollapsed, toggleCollapsed }
}
