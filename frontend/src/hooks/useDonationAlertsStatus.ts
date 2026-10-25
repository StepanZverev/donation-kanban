// Статус подключения DonationAlerts. Опрашиваем бэкенд раз в несколько секунд:
// связь с DA может пропасть и восстановиться сама, без действий пользователя.

import { useCallback, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import type { DonationAlertsStatus } from '../api/auth'
import { DA_STATUS_REFRESH_MS } from '../defaults'

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
    const timer = window.setInterval(reload, DA_STATUS_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  async function disconnect() {
    try {
      await authApi.disconnect()
    } catch {
      // Не получилось — статус после перезагрузки покажет, что DonationAlerts всё ещё подключён
    }
    await reload()
  }

  return { status, disconnect }
}
