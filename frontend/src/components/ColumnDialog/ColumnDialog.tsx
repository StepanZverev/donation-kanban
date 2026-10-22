import { useEffect, useRef, useState, type FormEvent } from 'react'
import { COLUMN_TITLE_MAX_LENGTH } from '../../defaults'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import styles from './ColumnDialog.module.css'

type ColumnDialogProps = {
  heading: string
  // Название, с которым окно открывается: пустое у новой колонки, текущее — при переименовании
  initialTitle: string
  submitLabel: string
  onSubmit: (title: string) => void
  onClose: () => void
}

// Окно «Новая колонка» / «Колонка» на встроенном в браузер теге <dialog>.
// Пока в нём только название, позже сюда можно добавить другие настройки колонки.
// Родитель показывает компонент, только пока окно открыто.
export function ColumnDialog(props: ColumnDialogProps) {
  const { heading, initialTitle, submitLabel, onSubmit, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropClose = useBackdropClose(onClose)
  const [title, setTitle] = useState(initialTitle)

  // showModal() открывает окно поверх страницы и затемняет фон
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    // onClose срабатывает и при нажатии Esc, а клик по серому фону — как «Отмена»
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} {...backdropClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.heading}>{heading}</h2>

        <label className={styles.field}>
          Название
          <input
            autoComplete="off"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={COLUMN_TITLE_MAX_LENGTH}
            required
            autoFocus
          />
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={styles.submit} disabled={title.trim() === ''}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  )

  function handleSubmit(event: FormEvent) {
    // Без preventDefault браузер перезагрузил бы страницу, отправляя форму
    event.preventDefault()
    onSubmit(title.trim())
  }
}
