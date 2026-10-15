// Запросы про текущего пользователя: кто я и выход.

// Как пользователь приходит с сервера (snake_case, см. CurrentUser в backend/app/schemas.py)
type CurrentUserFromApi = {
  id: number
  name: string | null
  avatar_url: string | null
  is_guest: boolean
  logins: string[]
  can_connect_donationalerts: boolean
}

export type CurrentUser = {
  id: number
  name: string | null // имя из DonationAlerts; у гостя пусто
  avatarUrl: string | null
  isGuest: boolean // гость — ещё не подключил DonationAlerts, доска живёт только в этом браузере
  canConnectDonationAlerts: boolean // вписаны ли ключи DA в backend/.env
}

// Первый запрос сам создаёт гостя: бэкенд запомнит браузер по cookie
export async function getMe(): Promise<CurrentUser> {
  const response = await fetch('/api/me')
  if (!response.ok) {
    throw new Error(`Не удалось узнать, кто вошёл: ${response.status}`)
  }
  const user: CurrentUserFromApi = await response.json()
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url,
    isGuest: user.is_guest,
    canConnectDonationAlerts: user.can_connect_donationalerts,
  }
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/me/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось выйти: ${response.status}`)
  }
}
