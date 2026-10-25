import { useState, type FormEvent } from 'react'
import { COLUMN_TITLE_MAX_LENGTH } from '../../defaults'
import { Modal } from '../Modal/Modal'
import styles from './ColumnDialog.module.css'

type ColumnDialogProps = {
  heading: string
  // Название, с которым окно открывается: пустое у новой колонки, текущее — при переименовании
  initialTitle: string
  submitLabel: string
  onSubmit: (title: string) => void
  onClose: () => void
}

// Окно «Новая колонка» / «Колонка».
// Пока в нём только название, позже сюда можно добавить другие настройки колонки.
// Родитель показывает компонент, только пока окно открыто.
export function ColumnDialog(props: ColumnDialogProps) {
  const { heading, initialTitle, submitLabel, onSubmit, onClose } = props
  const [title, setTitle] = useState(initialTitle)

  return (
    <Modal heading={heading} width={400} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
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
          <button type="submit" className="primary-button" disabled={title.trim() === ''}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )

  function handleSubmit(event: FormEvent) {
    // Без preventDefault браузер перезагрузил бы страницу, отправляя форму
    event.preventDefault()
    onSubmit(title.trim())
  }
}
