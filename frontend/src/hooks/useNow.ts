import { useEffect, useState } from 'react'

// Текущее время, которое само обновляется раз в intervalMs миллисекунд.
// Нужно, чтобы подписи вида «Сегодня» / «Вчера» в истории менялись без перезагрузки.
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
