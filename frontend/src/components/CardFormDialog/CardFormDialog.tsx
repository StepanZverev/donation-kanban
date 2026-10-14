import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { CardDraft } from '../../types/card'
import { getCurrencySymbol } from '../../utils/money'
import { NickInput } from '../NickInput/NickInput'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import styles from './CardFormDialog.module.css'

type CardFormDialogProps = {
  heading: string
  initialDraft: CardDraft
  // Валюта суммы карточки (у доната в долларах — USD). null — валюта стримера.
  currency: string | null
  onSubmit: (draft: CardDraft) => void
  onClose: () => void
}

// Модальное окно на встроенном в браузер теге <dialog>.
// Компонент показывается только пока открыт: родитель рендерит его или не рендерит.
export function CardFormDialog(props: CardFormDialogProps) {
  const { heading, initialDraft, currency, onSubmit, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropClose = useBackdropClose(onClose)
  const [donorName, setDonorName] = useState(initialDraft.donorName)
  // Сумму храним строкой, как она написана в поле: так можно стереть её целиком
  const [amount, setAmount] = useState(initialDraft.amount === null ? '' : String(initialDraft.amount))
  const [text, setText] = useState(initialDraft.text)

  // showModal() открывает окно поверх страницы и затемняет фон.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    // onClose срабатывает и при нажатии Esc, а клик по серому фону — как «Отмена»
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} {...backdropClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.heading}>{heading}</h2>

        {/* Ник и сумма в одну строку */}
        <div className={styles.row}>
          <label className={`${styles.field} ${styles.nick}`}>
            Ник
            <NickInput value={donorName} onChange={setDonorName} />
          </label>

          <label className={`${styles.field} ${styles.amount}`}>
            Сумма
            <span className={styles.amountInput}>
              <input
                autoComplete="off"
                type="number"
                min={0}
                step="any"
                placeholder="Без суммы"
                value={amount}
                onChange={handleAmountChange}
              />
              <span className={styles.currency}>{getCurrencySymbol(currency)}</span>
            </span>
          </label>
        </div>

        <label className={styles.field}>
          Текст
          <textarea
            autoComplete="off"
            value={text}
            onChange={handleTextChange}
            maxLength={2000}
            rows={5}
            autoFocus
          />
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit">
            Сохранить
          </button>
        </div>
      </form>
    </dialog>
  )

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(event.target.value)
  }

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Пустое поле — без суммы. Минус браузер не пропустит (min=0).
    const parsedAmount = amount.trim() === '' ? null : Number(amount)
    onSubmit({
      donorName: donorName.trim(),
      text: text.trim(),
      amount: parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null,
    })
  }
}
