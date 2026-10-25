// Подписка на живые обновления доски через WebSocket (встроен в браузер).
// Когда на сервере что-то меняется (пришёл донат, модератор в другой вкладке
// передвинул карточку), сервер присылает {"type": "board_changed"},
// и мы вызываем onChange — обычно это перезагрузка данных.
// path — адрес соединения: у открытой доски /api/boards/<id>/ws (getBoardUpdatesPath),
// у зрителя — доска по ссылке /api/public/boards/<токен>/ws.
//
// Подписываются сразу многие хуки: карточки, сумма за стрим, настройки и т. д.
// Чтобы не открывать соединение на каждый, соединение с одним адресом общее:
// первый подписчик его открывает, остальные присоединяются, последний ушедший закрывает.

import { useEffect } from 'react'
import { BOARD_RECONNECT_DELAY_MS } from '../defaults'

export function useBoardUpdates(onChange: () => void, path: string) {
  useEffect(() => {
    const connection = connections.get(path) ?? openConnection(path)
    connection.listeners.add(onChange)

    // Страницу закрыли или ушли на другую — отписываемся
    return () => {
      connection.listeners.delete(onChange)
      if (connection.listeners.size === 0) {
        connection.close()
      }
    }
  }, [onChange, path])
}

// Общее соединение: кого позвать, когда доска поменялась, и как его закрыть
type SharedConnection = {
  listeners: Set<() => void>
  close: () => void
}

// Открытые сейчас соединения, по адресу
const connections = new Map<string, SharedConnection>()

function openConnection(path: string): SharedConnection {
  const listeners = new Set<() => void>()
  let socket: WebSocket | null = null
  let reconnectTimer: number | undefined
  let isClosed = false

  function notifyListeners() {
    listeners.forEach((listener) => listener())
  }

  function connect() {
    // ws:// для http, wss:// для https. Адрес тот же, что у страницы:
    // в разработке Vite перешлёт соединение на бэкенд (см. vite.config.ts).
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    socket = new WebSocket(`${protocol}://${window.location.host}${path}`)

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'board_changed') {
        notifyListeners()
      }
    }

    // Бэкенд перезапустили или пропала сеть — пробуем снова чуть позже.
    // После переподключения тоже перезагружаем данные: пока связи не было,
    // могли прийти донаты.
    socket.onclose = () => {
      if (!isClosed) {
        reconnectTimer = window.setTimeout(() => {
          connect()
          notifyListeners()
        }, BOARD_RECONNECT_DELAY_MS)
      }
    }
  }

  function close() {
    isClosed = true
    connections.delete(path)
    window.clearTimeout(reconnectTimer)
    // Если соединение ещё устанавливается, закрываем его сразу после установки.
    // Иначе браузер пишет в консоль предупреждение «closed before the connection
    // is established» (в режиме разработки React специально монтирует эффекты дважды).
    if (socket?.readyState === WebSocket.CONNECTING) {
      const connectingSocket = socket
      connectingSocket.onopen = () => connectingSocket.close()
    } else {
      socket?.close()
    }
  }

  connect()
  const connection = { listeners, close }
  connections.set(path, connection)
  return connection
}
