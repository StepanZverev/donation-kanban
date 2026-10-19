import { useBoard } from '../../hooks/useBoard'
import { AccountMenu } from '../AccountMenu/AccountMenu'
import { Navigation } from '../Navigation/Navigation'
import { StreamerAccountMenu } from '../StreamerAccountMenu/StreamerAccountMenu'
import { StreamTotal } from '../StreamTotal/StreamTotal'
import styles from './AppHeader.module.css'

// Шапка приложения в одну строку: логотип, вкладки, справа сумма за стрим и меню аккаунта.
// Статус DonationAlerts и переключатель приёма — в меню аккаунта (StreamerAccountMenu).
type AppHeaderProps = {
  // Точки «есть новое» у вкладок (см. useNewDonations)
  hasNewOnBoard: boolean
  hasNewInHistory: boolean
}

export function AppHeader(props: AppHeaderProps) {
  const { hasNewOnBoard, hasNewInHistory } = props
  const board = useBoard()

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
          {board.role === 'owner' ? (
            // На своей доске в меню ещё статус DonationAlerts и переключатель приёма
            <StreamerAccountMenu />
          ) : (
            <>
              <span className={styles.moderatorBadge}>
                Модератор · доска {board.ownerName ?? 'стримера'}
              </span>
              <AccountMenu />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
