import { useEffect, useState } from 'react'

// Прошло ли от момента time (в миллисекундах) меньше durationMs.
// Сама становится false, когда время выходит: один таймер вместо перерисовки каждую секунду.
export function useIsRecent(time: number, durationMs: number) {
  // Для какого момента время уже вышло. Сравниваем с time: пришло новое событие —
  // значит, снова «недавно», пока не сработает новый таймер.
  const [expiredTime, setExpiredTime] = useState(() =>
    time + durationMs <= Date.now() ? time : null,
  )

  useEffect(() => {
    const timeLeft = Math.max(0, time + durationMs - Date.now())
    const timer = window.setTimeout(() => setExpiredTime(time), timeLeft)
    return () => window.clearTimeout(timer)
  }, [time, durationMs])

  return expiredTime !== time
}
