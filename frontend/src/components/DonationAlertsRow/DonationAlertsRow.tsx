import type { ReactNode } from 'react'
import { LOGIN_URL, type DonationAlertsStatus } from '../../api/auth'
import styles from './DonationAlertsRow.module.css'

type DonationAlertsRowProps = {
  status: DonationAlertsStatus
  // Подпись под названием: что сейчас с DonationAlerts
  note: string
  // Значок слева, например точка статуса. Не передали — значка нет.
  indicator?: ReactNode
  // Что спросить перед тем, как отключить
  disconnectQuestion: string
  onDisconnect: () => void
  // Свой класс для отступов вокруг строки
  className?: string
}

// Строка «DonationAlerts» в меню аккаунта: подключён ли, и рядом «Подключить» или «Отключить».
// Одинаковая у стримера и у модератора.
export function DonationAlertsRow(props: DonationAlertsRowProps) {
  const { status, note, indicator, disconnectQuestion, onDisconnect, className } = props

  return (
    <div className={className ? `${styles.row} ${className}` : styles.row}>
      {indicator}
      <span className={styles.text}>
        DonationAlerts
        <span className={styles.note}>{note}</span>
      </span>
      {/* Подключить можно, только если ключи приложения вписаны в backend/.env */}
      {status.configured && !status.connected && (
        <a className={styles.connectButton} href={LOGIN_URL}>
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
    if (window.confirm(disconnectQuestion)) {
      onDisconnect()
    }
  }
}
