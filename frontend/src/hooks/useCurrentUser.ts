// Кто открыл сайт: гость или пользователь, подключивший DonationAlerts.

import { useEffect, useState } from 'react'
import * as meApi from '../api/me'
import type { CurrentUser } from '../api/me'

export function useCurrentUser() {
  // null — ещё не загрузили (или бэкенд не отвечает)
  const [user, setUser] = useState<CurrentUser | null>(null)
  // Бэкенд не ответил
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    meApi
      .getMe()
      .then(setUser)
      .catch(() => setHasFailed(true))
  }, [])

  // После выхода перезагружаем страницу: бэкенд встретит браузер как нового гостя
  async function logout() {
    await meApi.logout()
    window.location.assign('/')
  }

  return { user, hasFailed, logout }
}
