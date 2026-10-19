// Свёрнут ли блок «Как заказать» на странице зрителя.
// Зритель, который уже выучил правила, может свернуть блок в одну строку.
// Выбор хранится в браузере (localStorage), один на все доски: свернул раз — запомнилось.

import { useState } from 'react'

const STORAGE_KEY = 'viewer-rules-collapsed'

function isCollapsedSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    if (collapsed) {
      localStorage.setItem(STORAGE_KEY, 'on')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Браузер не даёт сохранить (например, приватное окно) — выбор проживёт до перезагрузки
  }
}

export function useRulesCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(isCollapsedSaved)

  function toggleCollapsed() {
    saveCollapsed(!isCollapsed)
    setIsCollapsed(!isCollapsed)
  }

  return { isCollapsed, toggleCollapsed }
}
