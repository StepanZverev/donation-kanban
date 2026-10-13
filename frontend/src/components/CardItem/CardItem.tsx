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
  // Что делают стрелки по бокам карточки:
  // move — перенос в соседнюю колонку, delete — удалить (красная), finish — в историю выполненной (зелёная)
  leftArrow: 'move' | 'delete'
  rightArrow: 'move' | 'finish'
  onLeftClick: (card: Card) => void
  onRightClick: (card: Card) => void
}

export function CardItem(props: CardItemProps) {
  const {
    card,
    moveTargets,
    onEdit,
    onMove,
    onDelete,
    leftArrow,
    rightArrow,
    onLeftClick,
    onRightClick,
  } = props
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
      {/* Стрелки по бокам видны при наведении на карточку */}
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft} ${leftArrow === 'delete' ? styles.danger : ''}`}
        title={leftArrow === 'delete' ? 'Удалить' : 'В колонку слева'}
        onClick={handleLeftClick}
      >
        ‹
      </button>

      <div className={styles.content}>
        <header className={styles.header}>
          <h3 className={styles.heading}>{heading}</h3>
          <div className={styles.menuSlot}>
            <CardMenu
              moveTargets={moveTargets}
              onEdit={handleEdit}
              onMove={handleMove}
              onDelete={handleDelete}
            />
          </div>
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
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight} ${rightArrow === 'finish' ? styles.success : ''}`}
        title={rightArrow === 'finish' ? 'Выполнено, убрать в историю' : 'В колонку справа'}
        onClick={handleRightClick}
      >
        ›
      </button>
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

  function handleLeftClick() {
    onLeftClick(card)
  }

  function handleRightClick() {
    onRightClick(card)
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
}
