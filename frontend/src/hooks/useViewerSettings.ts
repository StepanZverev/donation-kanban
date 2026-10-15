// Раздел настроек «Для зрителей»: ссылка для зрителей и ссылка на донат.

import { useCallback, useEffect, useState } from 'react'
import * as viewerApi from '../api/viewer'
import type { ViewerSettings } from '../api/viewer'
import { useBoardUpdates } from './useBoardUpdates'

export function useViewerSettings() {
  // null — ещё не загрузили
  const [settings, setSettings] = useState<ViewerSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return viewerApi
      .getViewerSettings()
      .then((loaded) => {
        setSettings(loaded)
        setError(null)
      })
      .catch(() => setError('Не удалось загрузить настройки. Проверь, что бэкенд запущен.'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Настройки могли поменять в другой вкладке
  useBoardUpdates(reload)

  // Все действия устроены одинаково: отправить запрос и показать то, что вернул сервер.
  // Ошибку показываем рядом с настройками. Возвращает true, если сохранилось.
  async function run(request: () => Promise<ViewerSettings>) {
    try {
      setSettings(await request())
      setError(null)
      return true
    } catch (requestError) {
      setError(`Не удалось сохранить: ${(requestError as Error).message}`)
      return false
    }
  }

  function saveDonationUrl(url: string) {
    return run(() => viewerApi.saveDonationUrl(url))
  }

  function createPublicLink() {
    return run(viewerApi.createPublicLink)
  }

  function deletePublicLink() {
    return run(viewerApi.deletePublicLink)
  }

  return { settings, error, saveDonationUrl, createPublicLink, deletePublicLink }
}
