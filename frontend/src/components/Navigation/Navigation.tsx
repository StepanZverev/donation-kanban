import { NavLink } from 'react-router'
import styles from './Navigation.module.css'

type NavigationProps = {
  // Точка «есть новое»: пришёл донат на доску или отсеялся донат в историю,
  // пока стример был на другой вкладке (см. useNewDonations)
  hasNewOnBoard: boolean
  hasNewInHistory: boolean
}

// NavLink — это ссылка из React Router, которая сама знает, активна ли она
// (совпадает ли её адрес с текущим), и передаёт это в className.
export function Navigation({ hasNewOnBoard, hasNewInHistory }: NavigationProps) {
  return (
    <nav className={styles.navigation}>
      <NavLink to="/" end className={getLinkClassName}>
        Доска
        {hasNewOnBoard && <span className={styles.newDot} title="Есть новые донаты" />}
      </NavLink>
      <NavLink to="/history" className={getLinkClassName}>
        История
        {hasNewInHistory && <span className={styles.newDot} title="Есть отсеянные донаты" />}
      </NavLink>
      <NavLink to="/settings" className={getLinkClassName}>
        Настройки
      </NavLink>
    </nav>
  )

  function getLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.link} ${styles.active}` : styles.link
  }
}
