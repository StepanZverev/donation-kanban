// Статус подключения DonationAlerts. Опрашиваем бэкенд раз в несколько секунд:
// связь с DA может пропасть и восстановиться сама, без действий пользователя.

import { useCallback, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import type { DonationAlertsStatus } from '../api/auth'

const REFRESH_INTERVAL_MS = 5000

export function useDonationAlertsStatus() {
  const [status, setStatus] = useState<DonationAlertsStatus | null>(null)

  const reload = useCallback(() => {
    return authApi
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    reload()
    const timer = window.setInterval(reload, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  async function disconnect() {
    await authApi.logout()
    await reload()
  }

  return { status, disconnect }
}
