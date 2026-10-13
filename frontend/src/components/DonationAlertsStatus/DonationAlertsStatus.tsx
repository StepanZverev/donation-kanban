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

  // Пока всё хорошо (донаты слушаются), в шапке только точка и название.
  // В остальных случаях рядом короткое пояснение, что не так.
  const isListening = status.listener === 'listening'

  return (
    // Подробности — во всплывающей подсказке при наведении
    <div className={styles.status} title={`DonationAlerts: ${listenerLabels[status.listener]}`}>
      <span className={styles.label}>
        <span className={`${styles.dot} ${styles[status.listener]}`} />
        <span className={styles.name}>DonationAlerts</span>
        {!isListening && <span className={styles.state}>{listenerLabels[status.listener]}</span>}
      </span>

      {!status.configured && (
        <span className={styles.part} title="Впиши ключи в backend/.env и перезапусти бэкенд">
          ключи в backend/.env
        </span>
      )}

      {status.configured && !status.connected && (
        <a className={`${styles.part} ${styles.connect}`} href={LOGIN_URL}>
          Подключить
        </a>
      )}

      {status.connected && (
        <button type="button" className={styles.part} onClick={handleDisconnectClick}>
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
