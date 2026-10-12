import { useState, type DragEvent } from 'react'
import type { Card } from '../../types/card'
import styles from './CardItem.module.css'

type CardItemProps = {
  card: Card
  onEdit: (card: Card) => void
  onRemove: (card: Card) => void
}

export function CardItem({ card, onEdit, onRemove }: CardItemProps) {
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
        <button type="button" onClick={handleEdit}>
          Изменить
        </button>
        <button type="button" onClick={handleRemove}>
          Убрать
        </button>
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

  function handleRemove() {
    if (window.confirm(`Убрать «${card.title}» с доски в историю?`)) {
      onRemove(card)
    }
  }
}
