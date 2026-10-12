// Запросы про подключение DonationAlerts.

export type ListenerStatus = 'not_configured' | 'not_connected' | 'connecting' | 'listening' | 'error'

export type DonationAlertsStatus = {
  configured: boolean // вписаны ли ключи в backend/.env
  connected: boolean // вошли ли в DonationAlerts
  listener: ListenerStatus // что сейчас делает фоновая задача на бэкенде
}

// Чтобы подключить DA, браузер просто переходит по этому адресу:
// бэкенд перенаправит на страницу DonationAlerts, а после входа вернёт обратно.
export const LOGIN_URL = '/api/auth/login'

export async function getStatus(): Promise<DonationAlertsStatus> {
  const response = await fetch('/api/auth/status')
  if (!response.ok) {
    throw new Error(`Не удалось узнать статус DonationAlerts: ${response.status}`)
  }
  return response.json()
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось отключить DonationAlerts: ${response.status}`)
  }
}
