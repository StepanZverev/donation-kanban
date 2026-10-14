import { DonationAlertsStatus } from '../DonationAlertsStatus/DonationAlertsStatus'
import { IntakeToggle } from '../IntakeToggle/IntakeToggle'
import { Navigation } from '../Navigation/Navigation'
import { StreamTotal } from '../StreamTotal/StreamTotal'
import styles from './AppHeader.module.css'

// Шапка приложения в одну строку: логотип, вкладки, справа сумма за стрим,
// переключатель приёма заказов и статус DonationAlerts.
type AppHeaderProps = {
  // Точки «есть новое» у вкладок (см. useNewDonations)
  hasNewOnBoard: boolean
  hasNewInHistory: boolean
}

export function AppHeader({ hasNewOnBoard, hasNewInHistory }: AppHeaderProps) {
  return (
    // full-width: фон шапки тянется на всю ширину окна, а содержимое стоит в рабочей области
    <header className={`${styles.header} full-width`}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            {/* Три столбика разной высоты — как колонки доски */}
            <svg viewBox="0 0 16 16">
              <rect x="2" y="3" width="3" height="10" rx="1" />
              <rect x="6.5" y="3" width="3" height="7" rx="1" />
              <rect x="11" y="3" width="3" height="4" rx="1" />
            </svg>
          </span>
          Донатная доска
        </div>

        <Navigation hasNewOnBoard={hasNewOnBoard} hasNewInHistory={hasNewInHistory} />

        <div className={styles.right}>
          <StreamTotal />
          <IntakeToggle />
          <DonationAlertsStatus />
        </div>
      </div>
    </header>
  )
}
