import { NavLink } from 'react-router'
import { useBoard } from '../../hooks/useBoard'
import styles from './Navigation.module.css'

type NavigationProps = {
  // Точка «есть новое»: пришёл донат на доску или отсеялся донат в историю,
  // пока стример был на другой вкладке (см. useNewDonations)
  hasNewOnBoard: boolean
  hasNewInHistory: boolean
}

// NavLink — это ссылка из React Router, которая сама знает, активна ли она
// (совпадает ли её адрес с текущим), и передаёт это в className.
export function Navigation(props: NavigationProps) {
  const { hasNewOnBoard, hasNewInHistory } = props
  const board = useBoard()
  // Все вкладки — внутри открытой доски: /boards/5, /boards/5/history, /boards/5/settings
  const boardPath = `/boards/${board.id}`

  return (
    <nav className={styles.navigation}>
      <NavLink to={boardPath} end className={getLinkClassName}>
        Доска
        {hasNewOnBoard && <span className={styles.newDot} title="Есть новые донаты" />}
      </NavLink>
      <NavLink to={`${boardPath}/history`} className={getLinkClassName}>
        История
        {hasNewInHistory && <span className={styles.newDot} title="Есть отсеянные донаты" />}
      </NavLink>
      {/* Настройки доски меняет только хозяин, модератору вкладка не нужна */}
      {board.role === 'owner' && (
        <NavLink to={`${boardPath}/settings`} className={getLinkClassName}>
          Настройки
        </NavLink>
      )}
    </nav>
  )

  function getLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.link} ${styles.active}` : styles.link
  }
}
