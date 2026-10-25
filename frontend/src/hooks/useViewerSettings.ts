// Раздел настроек «Для зрителей»: ссылка для зрителей и ссылка на донат.

import { getErrorDetail } from '../api/request'
import * as viewerApi from '../api/viewer'
import type { ViewerSettings } from '../api/viewer'
import { useBoard } from './useBoard'
import { useBoardData } from './useBoardData'

export function useViewerSettings() {
  const { id: boardId } = useBoard()
  // settings: null — ещё не загрузили
  const {
    data: settings,
    setData: setSettings,
    error,
    setError,
  } = useBoardData<ViewerSettings | null>(
    viewerApi.getViewerSettings,
    null,
    'Не удалось загрузить настройки. Проверь, что бэкенд запущен.',
  )

  // Все действия устроены одинаково: отправить запрос и показать то, что вернул сервер.
  // Ошибку показываем рядом с настройками, с объяснением бэкенда, если оно есть.
  // Возвращает true, если сохранилось.
  async function run(request: () => Promise<ViewerSettings>) {
    try {
      setSettings(await request())
      setError(null)
      return true
    } catch (requestError) {
      const detail = getErrorDetail(requestError)
      setError(detail ? `Не удалось сохранить: ${detail}` : 'Не удалось сохранить. Попробуй ещё раз.')
      return false
    }
  }

  function saveDonationUrl(url: string) {
    return run(() => viewerApi.saveDonationUrl(boardId, url))
  }

  function createPublicLink() {
    return run(() => viewerApi.createPublicLink(boardId))
  }

  function deletePublicLink() {
    return run(() => viewerApi.deletePublicLink(boardId))
  }

  return { settings, error, saveDonationUrl, createPublicLink, deletePublicLink }
}
