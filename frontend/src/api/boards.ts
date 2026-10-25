// Запросы про доску целиком: кто я на ней, модераторы и ссылка-приглашение
// (backend/app/routes/members.py).
//
// Все запросы к доске идут по адресам /api/boards/<id доски>/..., поэтому функции
// в api/cards.ts, api/columns.ts и других первым параметром получают boardId.

import { request, requestOrNull } from './request'

// Кто пользователь на доске: хозяин может всё, модератор — работать с карточками
export type BoardRole = 'owner' | 'moderator'

export type BoardInfo = {
  id: number
  // Имя хозяина доски из DonationAlerts. null — хозяин гость, имени нет.
  ownerName: string | null
  role: BoardRole
  // Как модератор представился на этой доске. null — у хозяина или если не представился.
  myNickname: string | null
}

type BoardInfoFromApi = { id: number; owner_name: string | null; role: BoardRole; my_nickname: string | null }

export function toBoardInfo(board: BoardInfoFromApi): BoardInfo {
  return { id: board.id, ownerName: board.owner_name, role: board.role, myNickname: board.my_nickname }
}

// Адрес живых обновлений доски (см. useBoardUpdates)
export function getBoardUpdatesPath(boardId: number) {
  return `/api/boards/${boardId}/ws`
}

// Доска и роль на ней. null — доски нет или доступа к ней нет (например, модератора убрали).
export async function getBoard(boardId: number): Promise<BoardInfo | null> {
  const board = await requestOrNull<BoardInfoFromApi>('GET', `/api/boards/${boardId}`)
  return board ? toBoardInfo(board) : null
}

export type BoardMember = {
  userId: number
  // Как модератор представился, когда принимал приглашение
  nickname: string | null
  // Имя из DonationAlerts
  name: string | null
  avatarUrl: string | null
  // Гость — не входил через DonationAlerts, имени нет
  isGuest: boolean
}

type BoardMemberFromApi = {
  user_id: number
  nickname: string | null
  name: string | null
  avatar_url: string | null
  is_guest: boolean
}

export async function getMembers(boardId: number): Promise<BoardMember[]> {
  const members = await request<BoardMemberFromApi[]>('GET', `/api/boards/${boardId}/members`)
  return members.map((member) => ({
    userId: member.user_id,
    nickname: member.nickname,
    name: member.name,
    avatarUrl: member.avatar_url,
    isGuest: member.is_guest,
  }))
}

export async function removeMember(boardId: number, userId: number): Promise<void> {
  await request('DELETE', `/api/boards/${boardId}/members/${userId}`)
}

// Секретная часть ссылки-приглашения (/invite/<токен>). null — приглашения выключены.
// Все три запроса про ссылку отвечают одинаково: какой токен теперь.
async function requestInviteToken(method: string, boardId: number): Promise<string | null> {
  const body = await request<{ invite_token: string | null }>(method, `/api/boards/${boardId}/invite-link`)
  return body.invite_token
}

export async function getInviteToken(boardId: number): Promise<string | null> {
  return requestInviteToken('GET', boardId)
}

// Включает приглашения или делает новую ссылку (старая перестаёт работать)
export async function createInviteLink(boardId: number): Promise<string | null> {
  return requestInviteToken('POST', boardId)
}

export async function deleteInviteLink(boardId: number): Promise<string | null> {
  return requestInviteToken('DELETE', boardId)
}

// Полный адрес приглашения, его стример отправляет модератору
export function getInvitePageUrl(token: string) {
  return `${window.location.origin}/invite/${token}`
}

export type Invite = {
  boardId: number
  ownerName: string | null
  // Кто человек уже на этой доске. null — пока никто, приглашение можно принять.
  role: BoardRole | null
}

// Что за приглашение. null — ссылка не работает (неверная, выключена или заменена).
export async function getInvite(token: string): Promise<Invite | null> {
  const invite = await requestOrNull<{ board_id: number; owner_name: string | null; role: BoardRole | null }>(
    'GET',
    `/api/invites/${encodeURIComponent(token)}`,
  )
  return invite ? { boardId: invite.board_id, ownerName: invite.owner_name, role: invite.role } : null
}

// Модератор меняет, как его называть на этой доске. Пустое имя — «не представился».
export async function changeMyNickname(boardId: number, nickname: string): Promise<BoardInfo> {
  const board = await request<BoardInfoFromApi>('PUT', `/api/boards/${boardId}/members/me`, { nickname })
  return toBoardInfo(board)
}

// Принять приглашение и стать модератором.
// nickname — как модератор представился (пустая строка — не представился)
export async function acceptInvite(token: string, nickname: string): Promise<BoardInfo> {
  const board = await request<BoardInfoFromApi>('POST', `/api/invites/${encodeURIComponent(token)}/accept`, {
    nickname,
  })
  return toBoardInfo(board)
}
