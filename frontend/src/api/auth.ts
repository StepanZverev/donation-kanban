// Запросы про подключение DonationAlerts.

import { request } from './request'

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
  return request<DonationAlertsStatus>('GET', '/api/auth/status')
}

export async function disconnect(): Promise<void> {
  await request('POST', '/api/auth/disconnect')
}
