// Запросы про текущего пользователя: кто я и выход.

import { toBoardInfo, type BoardInfo, type BoardRole } from './boards'
import { request } from './request'

// Как пользователь приходит с сервера (snake_case, см. CurrentUser в backend/app/schemas.py)
type CurrentUserFromApi = {
  id: number
  name: string | null
  avatar_url: string | null
  is_guest: boolean
  logins: string[]
  can_connect_donationalerts: boolean
  board_id: number
  moderated_boards: { id: number; owner_name: string | null; role: BoardRole; my_nickname: string | null }[]
}

export type CurrentUser = {
  id: number
  name: string | null // имя из DonationAlerts; у гостя пусто
  avatarUrl: string | null
  isGuest: boolean // гость — ещё не подключил DonationAlerts, доска живёт только в этом браузере
  canConnectDonationAlerts: boolean // вписаны ли ключи DA в backend/.env
  boardId: number // своя доска: её открываем по адресу «/»
  moderatedBoards: BoardInfo[] // чужие доски, где пользователь модератор
}

// Первый запрос сам создаёт гостя: бэкенд запомнит браузер по cookie
export async function getMe(): Promise<CurrentUser> {
  const user = await request<CurrentUserFromApi>('GET', '/api/me')
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url,
    isGuest: user.is_guest,
    canConnectDonationAlerts: user.can_connect_donationalerts,
    boardId: user.board_id,
    moderatedBoards: user.moderated_boards.map(toBoardInfo),
  }
}

export async function logout(): Promise<void> {
  await request('POST', '/api/me/logout')
}

// Удалить аккаунт и все данные. Браузер забывает cookie: дальше это новый посетитель
export async function deleteAccount(): Promise<void> {
  await request('DELETE', '/api/me')
}
