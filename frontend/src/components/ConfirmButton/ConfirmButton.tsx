import {
  useEffect,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import styles from './ConfirmButton.module.css'

// Отступ окошка от кнопки и сколько места нужно под кнопкой, чтобы окошко влезло снизу
const POPOVER_GAP = 6
const POPOVER_MIN_SPACE = 160

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
// Окошко закрывается по «Отмена», по Esc, по клику мимо и при прокрутке.
//
// Окошко стоит поверх всей страницы (position: fixed), а не внутри своего блока:
// иначе прокручиваемый блок (например, раздел настроек) обрезал бы его по краю.
export function ConfirmButton(props: ConfirmButtonProps) {
  const { children, title, question, confirmLabel, onConfirm, disabled, className } = props
  // Где стоит открытое окошко. null — окошко закрыто.
  const [popoverPosition, setPopoverPosition] = useState<CSSProperties | null>(null)
  const isOpen = popoverPosition !== null

  // Пока окошко открыто, прокрутка или изменение окна его закрывают:
  // кнопка уезжает, и окошко висело бы в воздухе
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const close = () => setPopoverPosition(null)
    // true — ловим прокрутку любого блока на странице, а не только всего окна
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  return (
    // onBlur на обёртке: фокус ушёл за пределы окошка (кликнули мимо) — закрываем
    <div onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={className}
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleButtonClick}
      >
        {children}
      </button>

      {isOpen && (
        <div className={styles.popover} style={popoverPosition} role="dialog" aria-label={title}>
          <p className={styles.question}>{question}</p>
          <div className={styles.buttons}>
            <button type="button" onClick={() => setPopoverPosition(null)}>
              Отмена
            </button>
            {/* autoFocus: окошко сразу в фокусе, и Enter подтверждает, а Esc закрывает */}
            <button type="button" className="danger-button" autoFocus onClick={handleConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  function handleButtonClick(event: MouseEvent<HTMLButtonElement>) {
    if (isOpen) {
      setPopoverPosition(null)
      return
    }
    // Ставим окошко под кнопкой, прижав к её правому краю.
    // Если снизу до края окна мало места, ставим над кнопкой.
    const button = event.currentTarget.getBoundingClientRect()
    const right = window.innerWidth - button.right
    const spaceBelow = window.innerHeight - button.bottom
    if (spaceBelow < POPOVER_MIN_SPACE) {
      setPopoverPosition({
        bottom: window.innerHeight - button.top + POPOVER_GAP,
        right,
      })
    } else {
      setPopoverPosition({ top: button.bottom + POPOVER_GAP, right })
    }
  }

  function handleConfirm() {
    setPopoverPosition(null)
    onConfirm()
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // relatedTarget — элемент, куда ушёл фокус. Если он внутри обёртки, не закрываем.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setPopoverPosition(null)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setPopoverPosition(null)
    }
  }
}
