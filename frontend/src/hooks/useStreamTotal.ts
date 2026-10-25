// Сумма за стрим в шапке и сброс доски.

import * as streamApi from '../api/stream'
import type { StreamTotal } from '../api/stream'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useStreamTotal() {
  const { id: boardId } = useBoard()
  // streamTotal: null — ещё не загрузили (или бэкенд не отвечает).
  // Об ошибке молчим: что бэкенд не отвечает, и так скажет доска, сумму просто не покажем.
  const { data: streamTotal, setData: setStreamTotal } = useBoardData<StreamTotal | null>(
    streamApi.getStreamTotal,
    null,
    null,
  )

  async function resetBoard() {
    try {
      setStreamTotal(await streamApi.resetBoard(boardId))
    } catch {
      window.alert('Не удалось сбросить доску. Проверь, что бэкенд запущен.')
    }
  }

  return { streamTotal, resetBoard }
}
