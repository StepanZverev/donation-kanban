import { useEffect } from 'react'
import type { UndoableAction } from '../../hooks/useCards'
import styles from './UndoToast.module.css'

// Сколько плашка висит на экране, прежде чем исчезнуть сама
const VISIBLE_MS = 8000

type UndoToastProps = {
  action: UndoableAction
  onUndo: (action: UndoableAction) => void
  onClose: (actionId: number) => void
}

// Плашка «Выкинута: Вася · 500 RUB. Отменить».
// Заменяет окна «Вы уверены?»: действие выполняется сразу, но его можно откатить.
// Плашек может быть несколько сразу — по одной на каждое действие.
export function UndoToast(props: UndoToastProps) {
  const { action, onUndo, onClose } = props

  // Через несколько секунд плашка закрывается сама.
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(action.id), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [action.id, onClose])

  return (
    <div className={styles.toast} role="status">
      <span className={styles.message}>{action.message}</span>
      <button type="button" className={styles.undoButton} onClick={handleUndo}>
        Отменить
      </button>
    </div>
  )

  function handleUndo() {
    onUndo(action)
  }
}
