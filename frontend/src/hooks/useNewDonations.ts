// Точки «есть новое» у вкладок «Доска» и «История».
//
// Сидим в истории, пришёл донат — у «Доски» появляется точка. Отсеялся донат,
// пока мы на доске, — точка у «Истории». Зашли на вкладку — точка пропала,
// а новые донаты на ней мигнули подсветкой.
//
// Как это устроено. Бэкенд говорит, когда пришёл самый свежий донат на доску
// и самый свежий отсеянный. Мы помним, до какого времени донаты уже видели:
// когда уходим с вкладки, всё, что на ней было, считается увиденным.
// Новое — то, что пришло позже увиденного.

import { useCallback, useEffect, useState } from 'react'
import { getLatestDonations, type LatestDonations } from '../api/cards'
import { useBoardUpdates } from './useBoardUpdates'

type Page = 'board' | 'history' | 'other'

function getPage(pathname: string): Page {
  if (pathname === '/') {
    return 'board'
  }
  if (pathname.startsWith('/history')) {
    return 'history'
  }
  return 'other'
}

// До какого времени донаты уже видели. Пустая строка — «с самого начала»:
// любое время доната больше неё (время приходит строкой вида '2026-10-14T12:55:00.123+00:00').
type Seen = { onBoard: string; toHistory: string }

function isNewer(time: string | null, seenTime: string | undefined) {
  return time !== null && seenTime !== undefined && time > seenTime
}

export function useNewDonations(pathname: string) {
  const [latest, setLatest] = useState<LatestDonations | null>(null)
  // null — ещё не загрузили. При первой загрузке всё, что уже есть, считаем увиденным.
  const [seen, setSeen] = useState<Seen | null>(null)
  // На какой вкладке были в прошлую отрисовку — чтобы заметить, что с неё ушли
  const [page, setPage] = useState(getPage(pathname))

  const reload = useCallback(() => {
    getLatestDonations()
      .then((loaded) => {
        setLatest(loaded)
        setSeen((current) => current ?? { onBoard: loaded.onBoard ?? '', toHistory: loaded.toHistory ?? '' })
      })
      // Бэкенд не отвечает — об этом и так скажет доска, точки просто не будет
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Пришёл донат или что-то поменялось — узнаём свежие времена
  useBoardUpdates(reload)

  // Ушли с вкладки — всё, что на ней было, теперь увидено. Состояние меняем прямо
  // во время отрисовки: так React советует отвечать на смену входных данных.
  const currentPage = getPage(pathname)
  if (currentPage !== page) {
    setPage(currentPage)
    if (latest && seen && page === 'board') {
      setSeen({ ...seen, onBoard: latest.onBoard ?? '' })
    }
    if (latest && seen && page === 'history') {
      setSeen({ ...seen, toHistory: latest.toHistory ?? '' })
    }
  }

  return {
    // Точки в навигации. На самой вкладке точка не нужна: новое и так видно.
    hasNewOnBoard: currentPage !== 'board' && isNewer(latest?.onBoard ?? null, seen?.onBoard),
    hasNewInHistory: currentPage !== 'history' && isNewer(latest?.toHistory ?? null, seen?.toHistory),
    // Донаты новее этих времён страницы подсветят, когда на них зайдут.
    // null — ещё не загрузили, подсвечивать нечего.
    boardSeenAt: seen?.onBoard ?? null,
    historySeenAt: seen?.toHistory ?? null,
    // Время самого свежего доната на доске (для звука). undefined — ещё не загрузили.
    latestOnBoard: latest ? latest.onBoard : undefined,
  }
}
