// Подписка на живые обновления доски через WebSocket (встроен в браузер).
// Когда на сервере что-то меняется (пришёл донат, модератор в другой вкладке
// передвинул карточку), сервер присылает {"type": "board_changed"},
// и мы вызываем onChange — обычно это перезагрузка карточек.
// path — адрес соединения: у открытой доски /api/boards/<id>/ws (getBoardUpdatesPath),
// у зрителя — доска по ссылке /api/public/boards/<токен>/ws.

import { useEffect } from 'react'

// Через сколько пытаться переподключиться, если соединение оборвалось
const RECONNECT_DELAY_MS = 2000

export function useBoardUpdates(onChange: () => void, path: string) {
  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let isStopped = false

    function connect() {
      // ws:// для http, wss:// для https. Адрес тот же, что у страницы:
      // в разработке Vite перешлёт соединение на бэкенд (см. vite.config.ts).
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}${path}`)

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

    // Если соединение ещё устанавливается, закрываем его сразу после установки.
    // Иначе браузер пишет в консоль предупреждение «closed before the connection
    // is established» (в режиме разработки React специально монтирует эффекты дважды).
    function closeSocket() {
      if (socket?.readyState === WebSocket.CONNECTING) {
        const connectingSocket = socket
        connectingSocket.onopen = () => connectingSocket.close()
      } else {
        socket?.close()
      }
    }

    connect()

    // Страницу закрыли или ушли на другую — закрываем соединение.
    return () => {
      isStopped = true
      window.clearTimeout(reconnectTimer)
      closeSocket()
    }
  }, [onChange, path])
}
