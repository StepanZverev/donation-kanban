import { useState, type DragEvent } from 'react'
import styles from './DropZone.module.css'

type DropZoneProps = {
  // delete — красная зона слева («удалено»), done — зелёная справа («выполнено»)
  kind: 'delete' | 'done'
  // Зону видно только пока тащат карточку
  isVisible: boolean
  onDropCard: (cardId: number) => void
}

// Узкая зона по краю доски: бросил туда карточку — она сразу ушла в историю.
export function DropZone(props: DropZoneProps) {
  const { kind, isVisible, onDropCard } = props
  const [isDragOver, setIsDragOver] = useState(false)
  const isDelete = kind === 'delete'

  return (
    <div
      className={[
        styles.zone,
        isDelete ? styles.delete : styles.done,
        isVisible ? styles.visible : '',
        isDragOver ? styles.dragOver : '',
      ].join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className={styles.icon}>{isDelete ? '🗑' : '✓'}</span>
      <span className={styles.label}>{isDelete ? 'Удалить' : 'Выполнено'}</span>
    </div>
  )

  function handleDragOver(event: DragEvent<HTMLElement>) {
    // Без preventDefault браузер считает, что сюда бросать нельзя.
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    // Курсор перешёл на иконку или подпись внутри зоны — это не уход из зоны.
    const cursorTarget = event.relatedTarget as Node | null
    if (!event.currentTarget.contains(cursorTarget)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const cardId = Number(event.dataTransfer.getData('text/plain'))
    if (cardId) {
      onDropCard(cardId)
    }
  }
}
