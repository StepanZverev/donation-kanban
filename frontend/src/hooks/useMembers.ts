// Раздел настроек «Модераторы»: ссылка-приглашение и список модераторов.

import { useCallback, useEffect, useState } from 'react'
import * as boardsApi from '../api/boards'
import type { BoardMember } from '../api/boards'
import { useBoard } from './useBoard'
import { useBoardUpdates } from './useBoardUpdates'

export function useMembers() {
  const { id: boardId } = useBoard()
  const [members, setMembers] = useState<BoardMember[]>([])
  // Секретная часть ссылки-приглашения. null — приглашения выключены (или ещё не загрузили).
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return Promise.all([boardsApi.getMembers(boardId), boardsApi.getInviteToken(boardId)])
      .then(([freshMembers, freshToken]) => {
        setMembers(freshMembers)
        setInviteToken(freshToken)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить модераторов. Проверь, что бэкенд запущен.'))
      .finally(() => setIsLoading(false))
  }, [boardId])

  useEffect(() => {
    reload()
  }, [reload])

  // Кто-то принял приглашение — список обновится сам
  useBoardUpdates(reload, boardsApi.getBoardUpdatesPath(boardId))

  async function createInviteLink() {
    try {
      setInviteToken(await boardsApi.createInviteLink(boardId))
    } catch {
      setError('Не удалось сделать ссылку. Попробуй ещё раз.')
    }
  }

  async function deleteInviteLink() {
    try {
      setInviteToken(await boardsApi.deleteInviteLink(boardId))
    } catch {
      setError('Не удалось выключить ссылку. Попробуй ещё раз.')
    }
  }

  async function removeMember(userId: number) {
    try {
      await boardsApi.removeMember(boardId, userId)
      await reload()
    } catch {
      setError('Не удалось убрать модератора. Попробуй ещё раз.')
    }
  }

  return { members, inviteToken, isLoading, error, createInviteLink, deleteInviteLink, removeMember }
}
