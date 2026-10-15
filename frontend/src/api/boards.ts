// Запросы про доску целиком: кто я на ней, модераторы и ссылка-приглашение
// (backend/app/routes/members.py).
//
// Все запросы к доске идут по адресам /api/boards/<id доски>/..., поэтому функции
// в api/cards.ts, api/columns.ts и других первым параметром получают boardId.

// Кто пользователь на доске: хозяин может всё, модератор — работать с карточками
export type BoardRole = 'owner' | 'moderator'

export type BoardInfo = {
  id: number
  // Имя хозяина доски из DonationAlerts. null — хозяин гость, имени нет.
  ownerName: string | null
  role: BoardRole
}

type BoardInfoFromApi = { id: number; owner_name: string | null; role: BoardRole }

export function toBoardInfo(board: BoardInfoFromApi): BoardInfo {
  return { id: board.id, ownerName: board.owner_name, role: board.role }
}

// Адрес живых обновлений доски (см. useBoardUpdates)
export function getBoardUpdatesPath(boardId: number) {
  return `/api/boards/${boardId}/ws`
}

// Доска и роль на ней. null — доски нет или доступа к ней нет (например, модератора убрали).
export async function getBoard(boardId: number): Promise<BoardInfo | null> {
  const response = await fetch(`/api/boards/${boardId}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить доску: ${response.status}`)
  }
  return toBoardInfo(await response.json())
}

export type BoardMember = {
  userId: number
  name: string | null
  avatarUrl: string | null
  // Гость — не входил через DonationAlerts, имени нет
  isGuest: boolean
}

export async function getMembers(boardId: number): Promise<BoardMember[]> {
  const response = await fetch(`/api/boards/${boardId}/members`)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить модераторов: ${response.status}`)
  }
  const members: { user_id: number; name: string | null; avatar_url: string | null; is_guest: boolean }[] =
    await response.json()
  return members.map((member) => ({
    userId: member.user_id,
    name: member.name,
    avatarUrl: member.avatar_url,
    isGuest: member.is_guest,
  }))
}

export async function removeMember(boardId: number, userId: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/members/${userId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Не удалось убрать модератора: ${response.status}`)
  }
}

// Секретная часть ссылки-приглашения (/invite/<токен>). null — приглашения выключены.
async function readInviteToken(response: Response): Promise<string | null> {
  if (!response.ok) {
    throw new Error(`ошибка ${response.status}`)
  }
  const body: { invite_token: string | null } = await response.json()
  return body.invite_token
}

export async function getInviteToken(boardId: number): Promise<string | null> {
  return readInviteToken(await fetch(`/api/boards/${boardId}/invite-link`))
}

// Включает приглашения или делает новую ссылку (старая перестаёт работать)
export async function createInviteLink(boardId: number): Promise<string | null> {
  return readInviteToken(await fetch(`/api/boards/${boardId}/invite-link`, { method: 'POST' }))
}

export async function deleteInviteLink(boardId: number): Promise<string | null> {
  return readInviteToken(await fetch(`/api/boards/${boardId}/invite-link`, { method: 'DELETE' }))
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
  const response = await fetch(`/api/invites/${encodeURIComponent(token)}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Не удалось открыть приглашение: ${response.status}`)
  }
  const invite: { board_id: number; owner_name: string | null; role: BoardRole | null } = await response.json()
  return { boardId: invite.board_id, ownerName: invite.owner_name, role: invite.role }
}

export async function acceptInvite(token: string): Promise<BoardInfo> {
  const response = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Не удалось принять приглашение: ${response.status}`)
  }
  return toBoardInfo(await response.json())
}
