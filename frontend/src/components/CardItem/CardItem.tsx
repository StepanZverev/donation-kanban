import { useState, type DragEvent } from 'react'
import type { Card } from '../../types/card'
import styles from './CardItem.module.css'

type CardItemProps = {
  card: Card
  onEdit: (card: Card) => void
  // Быстрые действия. Если колбэк не передали, кнопки нет:
  // например, у карточки в «Выполнено» нет кнопки ✓.
  onStart?: (card: Card) => void
  onComplete?: (card: Card) => void
  onRemove?: (card: Card) => void
}

export function CardItem(props: CardItemProps) {
  const { card, onEdit, onStart, onComplete, onRemove } = props
  const [isDragging, setIsDragging] = useState(false)
  const isDonation = card.source === 'donationalerts'

  return (
    <article
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      data-card-id={card.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isDonation && (
        <p className={styles.donation}>
          {card.donorName} · {card.amount} {card.currency}
        </p>
      )}

      <h3 className={styles.title}>{card.title}</h3>

      {card.description && <p className={styles.description}>{card.description}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.editButton} onClick={handleEdit}>
          Изменить
        </button>

        <div className={styles.quickActions}>
          {onStart && (
            <button type="button" title="Взять в работу" onClick={handleStart}>
              ▶
            </button>
          )}
          {onComplete && (
            <button type="button" title="Выполнено" onClick={handleComplete}>
              ✓
            </button>
          )}
          {onRemove && (
            <button type="button" title="Выкинуть в историю" onClick={handleRemove}>
              ✕
            </button>
          )}
        </div>
      </div>
    </article>
  )

  // Начали тащить: кладём id карточки в «посылку», которую получит колонка в onDrop.
  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData('text/plain', String(card.id))
    event.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  function handleDragEnd() {
    setIsDragging(false)
  }

  function handleEdit() {
    onEdit(card)
  }

  function handleStart() {
    onStart?.(card)
  }

  function handleComplete() {
    onComplete?.(card)
  }

  // Без окна «Вы уверены?»: если выкинули случайно, есть кнопка «Отменить» внизу.
  function handleRemove() {
    onRemove?.(card)
  }
}
