import { useEffect } from 'react'
import styles from './UndoToast.module.css'

// Сколько плашка висит на экране, прежде чем исчезнуть сама
const VISIBLE_MS = 6000

type UndoToastProps = {
  message: string
  onUndo: () => void
  onClose: () => void
}

// Плашка внизу экрана «Карточка выкинута. Отменить».
// Заменяет окна «Вы уверены?»: действие выполняется сразу, но его можно откатить.
export function UndoToast(props: UndoToastProps) {
  const { message, onUndo, onClose } = props

  // Через несколько секунд плашка закрывается сама.
  useEffect(() => {
    const timer = window.setTimeout(onClose, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className={styles.toast} role="status">
      <span>{message}</span>
      <button type="button" className={styles.undoButton} onClick={onUndo}>
        Отменить
      </button>
    </div>
  )
}
