import { sendFakeDonation } from '../../api/dev'
import { useBoard } from '../../hooks/useBoard'
import styles from './FakeDonationButton.module.css'

// Кнопка «Тестовый донат» в правом нижнем углу окна. Нужна только для проверки
// без настоящих донатов, поэтому стоит в стороне от всего остального. Потом её уберём.
export function FakeDonationButton() {
  const board = useBoard()

  return (
    // Карточка появится сама: бэкенд пришлёт обновление через WebSocket
    <button type="button" className={styles.button} onClick={handleClick}>
      + Тестовый донат
    </button>
  )

  function handleClick() {
    sendFakeDonation(board.id).catch(() => window.alert('Не удалось создать тестовый донат'))
  }
}
