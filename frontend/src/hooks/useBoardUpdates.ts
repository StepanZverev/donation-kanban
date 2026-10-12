// Подписка на живые обновления доски через WebSocket (встроен в браузер).
// Когда на сервере что-то меняется (пришёл донат, модератор в другой вкладке
// передвинул карточку), сервер присылает {"type": "board_changed"},
// и мы вызываем onChange — обычно это перезагрузка карточек.

import { useEffect } from 'react'

// Через сколько пытаться переподключиться, если соединение оборвалось
const RECONNECT_DELAY_MS = 2000

export function useBoardUpdates(onChange: () => void) {
  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let isStopped = false

    function connect() {
      // ws:// для http, wss:// для https. Адрес тот же, что у страницы:
      // в разработке Vite перешлёт соединение на бэкенд (см. vite.config.ts).
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}/api/ws`)

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'board_changed') {
          onChange()
        }
      }

      // Бэкенд перезапустили или пропала сеть — пробуем снова чуть позже.
      // После переподключения тоже перезагружаем данные: пока связи не было,
      // могли прийти донаты.
      socket.onclose = () => {
        if (!isStopped) {
          reconnectTimer = window.setTimeout(() => {
            connect()
            onChange()
          }, RECONNECT_DELAY_MS)
        }
      }
    }

    connect()

    // Страницу закрыли или ушли на другую — закрываем соединение.
    return () => {
      isStopped = true
      window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [onChange])
}
