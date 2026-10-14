import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Card } from '../../types/card'
import { describeCard } from '../../utils/donor'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import styles from './RejectDialog.module.css'

type RejectDialogProps = {
  card: Card
  // reason — причина отказа, может быть пустой
  onSubmit: (reason: string) => void
  onClose: () => void
}

// Окно «Отклонить донат»: карточка уйдёт в историю с пометкой «Отклонено» и причиной.
// Родитель показывает компонент, только пока окно открыто.
export function RejectDialog(props: RejectDialogProps) {
  const { card, onSubmit, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropClose = useBackdropClose(onClose)
  const [reason, setReason] = useState('')
  // О какой карточке речь: «Вася · 500 ₽»
  const cardLabel = describeCard(card)

  // showModal() открывает окно поверх страницы и затемняет фон
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    // onClose срабатывает и при нажатии Esc, а клик по серому фону — как «Отмена»
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} {...backdropClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.heading}>Отклонить донат</h2>
        <p className={styles.card}>{cardLabel}</p>

        <label className={styles.field}>
          Причина
          <input
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="Например, не по правилам канала"
            autoFocus
          />
          <span className={styles.hint}>Необязательно. Будет видна в истории.</span>
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className={styles.submit}>
            Отклонить
          </button>
        </div>
      </form>
    </dialog>
  )

  function handleSubmit(event: FormEvent) {
    // Без preventDefault браузер перезагрузил бы страницу, отправляя форму
    event.preventDefault()
    onSubmit(reason.trim())
  }
}
