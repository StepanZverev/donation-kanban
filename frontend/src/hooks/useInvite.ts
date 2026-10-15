// Приглашение стать модератором по ссылке /invite/<токен>: что за доска и «Принять».

import { useEffect, useState } from 'react'
import * as boardsApi from '../api/boards'
import type { Invite } from '../api/boards'

// loading — ещё грузим, ready — приглашение есть, broken — ссылка не работает
type InviteState =
  | { status: 'loading' }
  | { status: 'ready'; invite: Invite }
  | { status: 'broken' }
  | { status: 'error' }

export function useInvite(token: string) {
  const [state, setState] = useState<InviteState>({ status: 'loading' })
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    boardsApi
      .getInvite(token)
      .then((invite) => setState(invite ? { status: 'ready', invite } : { status: 'broken' }))
      .catch(() => setState({ status: 'error' }))
  }, [token])

  // Принимает приглашение и возвращает id доски, чтобы её открыть
  async function accept() {
    setIsAccepting(true)
    try {
      const board = await boardsApi.acceptInvite(token)
      return board.id
    } finally {
      setIsAccepting(false)
    }
  }

  return { state, isAccepting, accept }
}
