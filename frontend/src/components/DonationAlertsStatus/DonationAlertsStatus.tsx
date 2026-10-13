import { useState, type FocusEvent } from 'react'
import { LOGIN_URL, type ListenerStatus } from '../../api/auth'
import { useDonationAlertsStatus } from '../../hooks/useDonationAlertsStatus'
import styles from './DonationAlertsStatus.module.css'

// Коротко — рядом с названием в шапке (только когда что-то не так)
const shortLabels: Record<ListenerStatus, string> = {
  not_configured: 'не настроен',
  not_connected: 'не подключён',
  connecting: 'подключаюсь…',
  listening: 'слушаю донаты',
  error: 'нет связи',
}

// Подробно — в выпадашке по клику
const descriptions: Record<ListenerStatus, string> = {
  not_configured:
    'Ключи приложения не вписаны. Впиши DA_CLIENT_ID и DA_CLIENT_SECRET в backend/.env и перезапусти бэкенд.',
  not_connected: 'Приложение не подключено к твоему аккаунту DonationAlerts, донаты не приходят.',
  connecting: 'Подключаюсь к DonationAlerts. Обычно это занимает пару секунд.',
  listening: 'Всё работает: новые донаты сами появляются в очереди.',
  error: 'Связь с DonationAlerts прервалась. Переподключаюсь сам, нажимать ничего не нужно.',
}

// Статус DonationAlerts в шапке: капсула с точкой, по клику — выпадашка
// с описанием состояния и кнопкой «Подключить» или «Отключить».
export function DonationAlertsStatus() {
  const { status, disconnect } = useDonationAlertsStatus()
  const [isOpen, setIsOpen] = useState(false)

  // Бэкенд не отвечает — об этом и так скажет доска
  if (status === null) {
    return null
  }

  // Пока всё хорошо (донаты слушаются), в капсуле только точка и название
  const isListening = status.listener === 'listening'

  return (
    // onBlur на обёртке: фокус ушёл за пределы выпадашки (кликнули мимо) — закрываем
    <div className={styles.wrapper} onBlur={handleBlur}>
      <button
        type="button"
        className={styles.status}
        aria-expanded={isOpen}
        title={`DonationAlerts: ${shortLabels[status.listener]}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${styles.dot} ${styles[status.listener]}`} />
        <span className={styles.name}>DonationAlerts</span>
        {!isListening && <span className={styles.state}>{shortLabels[status.listener]}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <p className={styles.heading}>
            <span className={`${styles.dot} ${styles[status.listener]}`} />
            DonationAlerts: {shortLabels[status.listener]}
          </p>
          <p className={styles.description}>{descriptions[status.listener]}</p>

          {status.configured && !status.connected && (
            <a className={styles.connectButton} href={LOGIN_URL}>
              Подключить
            </a>
          )}

          {status.connected && (
            <button type="button" className={styles.disconnectButton} onClick={handleDisconnectClick}>
              Отключить
            </button>
          )}
        </div>
      )}
    </div>
  )

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // relatedTarget — элемент, куда ушёл фокус. Если он внутри выпадашки, не закрываем.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false)
    }
  }

  function handleDisconnectClick() {
    if (window.confirm('Отключить DonationAlerts? Новые донаты перестанут попадать на доску.')) {
      setIsOpen(false)
      disconnect()
    }
  }
}
