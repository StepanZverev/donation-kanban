// Раздел настроек «Модераторы»: ссылка-приглашение и список модераторов.

import * as boardsApi from '../api/boards'
import type { BoardMember } from '../api/boards'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

type Members = {
  members: BoardMember[]
  // Секретная часть ссылки-приглашения. null — приглашения выключены.
  inviteToken: string | null
}

// Список и ссылка в разделе рядом, поэтому грузим их вместе
async function loadMembers(boardId: number): Promise<Members> {
  const [members, inviteToken] = await Promise.all([boardsApi.getMembers(boardId), boardsApi.getInviteToken(boardId)])
  return { members, inviteToken }
}

export function useMembers() {
  const { id: boardId } = useBoard()
  // Кто-то принял приглашение — список обновится сам (useBoardData перечитывает его)
  const { data, isLoading, error, save } = useBoardData<Members>(
    loadMembers,
    { members: [], inviteToken: null },
    'Не удалось загрузить модераторов. Проверь, что бэкенд запущен.',
  )

  function createInviteLink() {
    return save(() => boardsApi.createInviteLink(boardId), 'Не удалось сделать ссылку. Попробуй ещё раз.')
  }

  // Вместе со ссылкой бэкенд убирает и всех модераторов: после перезагрузки пропадёт и список
  function deleteInviteLink() {
    return save(() => boardsApi.deleteInviteLink(boardId), 'Не удалось удалить ссылку. Попробуй ещё раз.')
  }

  function removeMember(userId: number) {
    return save(() => boardsApi.removeMember(boardId, userId), 'Не удалось убрать модератора. Попробуй ещё раз.')
  }

  return {
    members: data.members,
    inviteToken: data.inviteToken,
    isLoading,
    error,
    createInviteLink,
    deleteInviteLink,
    removeMember,
  }
}
