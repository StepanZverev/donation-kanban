// Кто открыл сайт: гость или пользователь, подключивший DonationAlerts.
//
// Бэкенд спрашиваем один раз при запуске (main.tsx), App.tsx кладёт ответ
// в CurrentUserContext, а компоненты берут его отсюда через useCurrentUser().

import { createContext, useContext } from 'react'
import * as meApi from '../api/me'
import type { CurrentUser } from '../api/me'

type CurrentUserContextValue = {
  // null — бэкенд не ответил
  user: CurrentUser | null
  setUser: (user: CurrentUser) => void
}

export const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

export function useCurrentUser() {
  const context = useContext(CurrentUserContext)
  if (context === null) {
    throw new Error('useCurrentUser() работает только внутри App')
  }
  const { user, setUser } = context

  // Спросить бэкенд заново. Например, приняли приглашение — в меню аккаунта
  // должна появиться новая доска.
  async function reloadUser() {
    try {
      setUser(await meApi.getMe())
    } catch {
      // Не вышло — ничего страшного: меню покажет новую доску после обновления страницы
    }
  }

  // После выхода перезагружаем страницу: бэкенд встретит браузер как нового гостя
  async function logout() {
    await meApi.logout()
    window.location.assign('/')
  }

  return { user, reloadUser, logout }
}
