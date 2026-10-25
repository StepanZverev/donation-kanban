// Тема оформления: светлая, тёмная или «как в системе».
// Выбор хранится в браузере (localStorage). На странице тема включается атрибутом
// <html data-theme="light"> или "dark": по нему index.css выбирает цвета.
// Первый раз атрибут ставит маленький скрипт в index.html, ещё до загрузки приложения,
// чтобы страница не мигала светлым фоном. Ключ 'theme' там тот же, что здесь.

import { readSaved, save } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

// Следит, какую тему сейчас выбрала операционная система
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function getSavedThemeMode(): ThemeMode {
  const saved = readSaved(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function saveThemeMode(mode: ThemeMode) {
  // «Как в системе» — это отсутствие выбора, поэтому просто стираем запись
  save(STORAGE_KEY, mode === 'system' ? null : mode)
  applyThemeMode(mode)
}

function applyThemeMode(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && systemDarkQuery.matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
}

// Если выбрано «как в системе», а система сама переключилась (например, вечером),
// сразу меняем тему и в приложении. Вызывается один раз при старте (main.tsx).
export function followSystemTheme() {
  systemDarkQuery.addEventListener('change', () => applyThemeMode(getSavedThemeMode()))
}
