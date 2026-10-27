import { useBoard } from '../../hooks/useBoard'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { ModeratorAccountMenu } from '../ModeratorAccountMenu/ModeratorAccountMenu'
import { Navigation } from '../Navigation/Navigation'
import { StreamerAccountMenu } from '../StreamerAccountMenu/StreamerAccountMenu'
import { StreamTotal } from '../StreamTotal/StreamTotal'
import styles from './AppHeader.module.css'

// Шапка приложения в одну строку: логотип, вкладки, справа сумма за стрим и меню аккаунта.
// Меню аккаунта своё у хозяина доски (StreamerAccountMenu: статус DonationAlerts и приём)
// и у модератора (ModeratorAccountMenu: «Модератор: имя» и меч).
type AppHeaderProps = {
  // Точки «есть новое» у вкладок (см. useNewDonations)
  hasNewOnBoard: boolean
  hasNewInHistory: boolean
}

export function AppHeader(props: AppHeaderProps) {
  const { hasNewOnBoard, hasNewInHistory } = props
  const board = useBoard()
  const { user, logout } = useCurrentUser()

  return (
    // full-width: фон шапки тянется на всю ширину окна, а содержимое стоит в рабочей области
    <header className={`${styles.header} full-width`}>
      <div className={styles.content}>
        <div className={styles.logo}>
          {/* Логотип — тот же файл, что иконка вкладки (public/favicon.svg) */}
          <img className={styles.logoMark} src="/favicon.svg" alt="" />
          Донат-доска
        </div>

        <Navigation hasNewOnBoard={hasNewOnBoard} hasNewInHistory={hasNewInHistory} />

        <div className={styles.right}>
          <StreamTotal />
          {/* Пока не знаем, кто вошёл (или бэкенд не отвечает), меню не показываем */}
          {user !== null &&
            (board.role === 'owner' ? (
              <StreamerAccountMenu user={user} onLogout={logout} />
            ) : (
              <ModeratorAccountMenu user={user} onLogout={logout} />
            ))}
        </div>
      </div>
    </header>
  )
}
