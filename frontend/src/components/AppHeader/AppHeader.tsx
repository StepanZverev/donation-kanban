import { sendFakeDonation } from '../../api/dev'
import { DonationAlertsStatus } from '../DonationAlertsStatus/DonationAlertsStatus'
import { Navigation } from '../Navigation/Navigation'
import styles from './AppHeader.module.css'

// Шапка приложения в одну строку: логотип, вкладки, справа тестовый донат и статус DonationAlerts.
// Позже справа появятся сумма за стрим и переключатель приёма заказов.
export function AppHeader() {
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

        <Navigation />

        <div className={styles.right}>
          {/* Карточка появится сама: бэкенд пришлёт обновление через WebSocket */}
          <button
            type="button"
            className={styles.fakeButton}
            title="Тестовый донат"
            onClick={handleFakeDonationClick}
          >
            +<span className={styles.wideOnly}> Тестовый донат</span>
          </button>
          <DonationAlertsStatus />
        </div>
      </div>
    </header>
  )

  function handleFakeDonationClick() {
    sendFakeDonation().catch(() => window.alert('Не удалось создать тестовый донат'))
  }
}
