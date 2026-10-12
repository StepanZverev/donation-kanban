import { NavLink } from 'react-router'
import styles from './Navigation.module.css'

// NavLink — это ссылка из React Router, которая сама знает, активна ли она
// (совпадает ли её адрес с текущим), и передаёт это в className.
export function Navigation() {
  return (
    <nav className={styles.navigation}>
      <NavLink to="/" end className={getLinkClassName}>
        Доска
      </NavLink>
      <NavLink to="/history" className={getLinkClassName}>
        История
      </NavLink>
    </nav>
  )

  function getLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.link} ${styles.active}` : styles.link
  }
}
