import { useEffect, useRef } from 'react'
import { CHANGELOG } from '../../changelog'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import styles from './WhatsNewDialog.module.css'

type WhatsNewDialogProps = {
  onClose: () => void
}

// Окно «Что нового»: версии приложения и что в каждой поменялось, сверху самая новая.
// Родитель показывает компонент, только пока окно открыто.
export function WhatsNewDialog({ onClose }: WhatsNewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropClose = useBackdropClose(onClose)

  // showModal() открывает окно поверх страницы и затемняет фон
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    // onClose срабатывает и при нажатии Esc, а клик по серому фону закрывает окно
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} {...backdropClose}>
      <div className={styles.content}>
        <h2 className={styles.heading}>Что нового</h2>
        <div className={styles.releases}>
          {CHANGELOG.map((release) => (
            <section key={release.version} className={styles.release}>
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
      </div>
    </dialog>
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
