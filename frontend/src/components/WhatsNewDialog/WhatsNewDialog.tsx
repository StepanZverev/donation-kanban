import { CHANGELOG } from '../../changelog'
import { Modal } from '../Modal/Modal'
import styles from './WhatsNewDialog.module.css'

type WhatsNewDialogProps = {
  onClose: () => void
}

// Окно «Что нового»: версии приложения и что в каждой поменялось, сверху самая новая.
// Родитель показывает компонент, только пока окно открыто.
export function WhatsNewDialog({ onClose }: WhatsNewDialogProps) {
  return (
    // Заголовок и «Закрыть» стоят на месте, а список версий прокручивается между ними
    <Modal heading="Что нового" width={480} onClose={onClose}>
      <div className={styles.releases}>
        {CHANGELOG.map((release) => (
          <section key={release.version}>
            <h3 className={styles.version}>
              {release.version}
              <span className={styles.date}> · {formatDate(release.date)}</span>
            </h3>
            <ul className={styles.changes}>
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Modal>
  )
}

// '2026-10-19' → '19 октября 2026'
function formatDate(date: string) {
  // Собираем дату из чисел: new Date('2026-10-19') считается по Гринвичу и западнее
  // показал бы 18 октября
  const [year, month, day] = date.split('-').map(Number)
  const text = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // Браузер пишет «19 октября 2026 г.» — «г.» убираем
  return text.replace(' г.', '')
}
