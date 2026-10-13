import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import styles from './ConfirmButton.module.css'

type ConfirmButtonProps = {
  // Что нарисовано на кнопке (например, иконка) и подсказка при наведении
  children: ReactNode
  title: string
  // Вопрос в окошке подтверждения и надпись на красной кнопке
  question: ReactNode
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  // Класс для самой кнопки, чтобы её внешний вид задавал тот, кто её ставит
  className?: string
}

// Кнопка, которая сначала спрашивает «Точно?» в маленьком окошке под собой,
// а действие выполняет только после нажатия красной кнопки в нём.
// Окошко закрывается по «Отмена», по Esc и по клику мимо.
export function ConfirmButton(props: ConfirmButtonProps) {
  const { children, title, question, confirmLabel, onConfirm, disabled, className } = props
  const [isOpen, setIsOpen] = useState(false)

  return (
    // onBlur на обёртке: фокус ушёл за пределы окошка (кликнули мимо) — закрываем
    <div className={styles.wrapper} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={className}
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        {children}
      </button>

      {isOpen && (
        <div className={styles.popover} role="dialog" aria-label={title}>
          <p className={styles.question}>{question}</p>
          <div className={styles.buttons}>
            <button type="button" onClick={() => setIsOpen(false)}>
              Отмена
            </button>
            {/* autoFocus: окошко сразу в фокусе, и Enter подтверждает, а Esc закрывает */}
            <button type="button" className={styles.confirmButton} autoFocus onClick={handleConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  function handleConfirm() {
    setIsOpen(false)
    onConfirm()
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // relatedTarget — элемент, куда ушёл фокус. Если он внутри обёртки, не закрываем.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }
}
