import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CardDraft } from '../../types/card'
import styles from './CardFormDialog.module.css'

type CardFormDialogProps = {
  heading: string
  initialDraft: CardDraft
  onSubmit: (draft: CardDraft) => void
  onClose: () => void
}

// Модальное окно на встроенном в браузер теге <dialog>.
// Компонент показывается только пока открыт: родитель рендерит его или не рендерит.
export function CardFormDialog({ heading, initialDraft, onSubmit, onClose }: CardFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(initialDraft.title)
  const [description, setDescription] = useState(initialDraft.description)

  // showModal() открывает окно поверх страницы и затемняет фон.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ title: title.trim(), description: description.trim() })
  }

  return (
    // onClose срабатывает и при нажатии Esc
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.heading}>{heading}</h2>

        <label className={styles.field}>
          Заголовок
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            autoFocus
          />
        </label>

        <label className={styles.field}>
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={title.trim() === ''}>
            Сохранить
          </button>
        </div>
      </form>
    </dialog>
  )
}
