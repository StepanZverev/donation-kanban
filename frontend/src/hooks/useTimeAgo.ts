import { useEffect, useState } from 'react'
import { formatTimeAgo, getTimeAgoChangeDelay } from '../utils/time'

// Подпись «3 мин назад» для времени isoTime, которая обновляется сама.
// Перерисовываем не каждую секунду, а ровно тогда, когда подпись меняется:
// через 10 секунд после «только что», потом раз в минуту, после часа — раз в час.
export function useTimeAgo(isoTime: string) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const delay = getTimeAgoChangeDelay(isoTime, now)
    // +50 мс — чтобы таймер точно сработал уже после смены подписи, а не за миг до неё
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 50)
    return () => window.clearTimeout(timer)
  }, [isoTime, now])

  return formatTimeAgo(isoTime, now)
}
