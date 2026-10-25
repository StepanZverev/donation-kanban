import { useState, type FormEvent } from 'react'
import { REJECT_NOTE_MAX_LENGTH } from '../../defaults'
import type { Card } from '../../types/card'
import { describeCard } from '../../utils/donor'
import { Modal } from '../Modal/Modal'
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
  const [reason, setReason] = useState('')
  // О какой карточке речь: «Вася · 500 ₽»
  const cardLabel = describeCard(card)

  return (
    <Modal heading="Отклонить донат" width={420} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.card}>{cardLabel}</p>

        <label className={styles.field}>
          Причина
          <input
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REJECT_NOTE_MAX_LENGTH}
            placeholder="Например, не по правилам канала"
            autoFocus
          />
          <span className={styles.hint}>Необязательно. Будет видна в истории.</span>
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="danger-button">
            Отклонить
          </button>
        </div>
      </form>
    </Modal>
  )

  function handleSubmit(event: FormEvent) {
    // Без preventDefault браузер перезагрузил бы страницу, отправляя форму
    event.preventDefault()
    onSubmit(reason.trim())
  }
}
