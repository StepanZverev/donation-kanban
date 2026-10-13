import { useState, type CSSProperties, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel } from '../../utils/priority'
import { CardMenu } from '../CardMenu/CardMenu'
import styles from './CardItem.module.css'

type CardItemProps = {
  card: Card
  // Колонки, в которые карточку можно перенести через меню «⋯»
  moveTargets: BoardColumn[]
  onEdit: (card: Card) => void
  onMove: (cardId: number, columnId: number) => void
  onDelete: (card: Card) => void
  // Быстрые действия. Если колбэк не передали, кнопки нет:
  // например, у карточки в «Выполнено» нет кнопки ✓.
  onStart?: (card: Card) => void
  onComplete?: (card: Card) => void
  onRemove?: (card: Card) => void
}

export function CardItem(props: CardItemProps) {
  const { card, moveTargets, onEdit, onMove, onDelete, onStart, onComplete, onRemove } = props
  const [isDragging, setIsDragging] = useState(false)
  // Длинное сообщение свёрнуто до трёх строк; клик по тексту разворачивает его.
  const [isExpanded, setIsExpanded] = useState(false)

  const isDonation = card.source === 'donationalerts'
  // Цвет обводки зависит от суммы доната. Ручные карточки считаются суммой 0.
  const priority = getPriorityLevel(card.streamerAmount ?? 0)
  // У доната заголовок — это обрезанное начало сообщения, а целиком оно лежит в описании.
  // Показываем сообщение один раз: описание, а если его нет — заголовок.
  const heading = isDonation ? card.donorName : card.title
  const text = isDonation ? card.description || card.title : card.description

  return (
    <article
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      // CSS-переменная с цветом уровня, её использует .card в CardItem.module.css
      style={{ '--priority-color': priority.color } as CSSProperties}
      data-card-id={card.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <header className={styles.header}>
        <h3 className={styles.heading}>{heading}</h3>
        {card.amount !== null && (
          <span className={styles.amount}>{formatMoney(card.amount, card.currency)}</span>
        )}
      </header>

      {text && (
        <p
          className={`${styles.text} ${isExpanded ? '' : styles.collapsed}`}
          onClick={handleTextClick}
        >
          {text}
        </p>
      )}

      <div className={styles.actions}>
        <div className={styles.menuSlot}>
          <CardMenu
            moveTargets={moveTargets}
            onEdit={handleEdit}
            onMove={handleMove}
            onDelete={handleDelete}
          />
        </div>

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

  function handleTextClick() {
    setIsExpanded(!isExpanded)
  }

  function handleEdit() {
    onEdit(card)
  }

  function handleMove(columnId: number) {
    onMove(card.id, columnId)
  }

  function handleDelete() {
    onDelete(card)
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
