import { LOGIN_URL, type ListenerStatus } from '../../api/auth'
import { useDonationAlertsStatus } from '../../hooks/useDonationAlertsStatus'
import styles from './DonationAlertsStatus.module.css'

const listenerLabels: Record<ListenerStatus, string> = {
  not_configured: 'не настроен',
  not_connected: 'не подключён',
  connecting: 'подключаюсь…',
  listening: 'слушаю донаты',
  error: 'нет связи, переподключаюсь…',
}

export function DonationAlertsStatus() {
  const { status, disconnect } = useDonationAlertsStatus()

  // Бэкенд не отвечает — об этом и так скажет доска
  if (status === null) {
    return null
  }

  return (
    <div className={styles.status}>
      <span className={`${styles.dot} ${styles[status.listener]}`} />
      <span>
        DonationAlerts: <b>{listenerLabels[status.listener]}</b>
      </span>

      {!status.configured && (
        <span className={styles.hint}>впиши ключи в backend/.env и перезапусти бэкенд</span>
      )}

      {status.configured && !status.connected && (
        <a className={styles.button} href={LOGIN_URL}>
          Подключить
        </a>
      )}

      {status.connected && (
        <button type="button" onClick={handleDisconnectClick}>
          Отключить
        </button>
      )}
    </div>
  )

  function handleDisconnectClick() {
    if (window.confirm('Отключить DonationAlerts? Новые донаты перестанут попадать на доску.')) {
      disconnect()
    }
  }
}
