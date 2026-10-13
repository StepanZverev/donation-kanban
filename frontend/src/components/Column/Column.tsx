import { useState, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import { CardItem } from '../CardItem/CardItem'
import styles from './Column.module.css'

type ColumnProps = {
  column: BoardColumn
  cards: Card[]
  onAddClick: () => void
  onEditCard: (card: Card) => void
  onStartCard: (card: Card) => void
  onCompleteCard: (card: Card) => void
  onRemoveCard: (card: Card) => void
  onDropCard: (cardId: number, columnId: number) => void
  onClearClick: () => void
}

export function Column(props: ColumnProps) {
  const {
    column,
    cards,
    onAddClick,
    onEditCard,
    onStartCard,
    onCompleteCard,
    onRemoveCard,
    onDropCard,
    onClearClick,
  } = props
  // Держат ли сейчас карточку над этой колонкой (чтобы подсветить её).
  const [isDragOver, setIsDragOver] = useState(false)
  const isIncomingColumn = column.kind === 'incoming'
  const isDoneColumn = column.kind === 'done'
  // «Куча» и «Выполнено» стоят по краям и выглядят иначе, чем промежуточные колонки.
  const isEdgeColumn = isIncomingColumn || isDoneColumn

  return (
    <section
      className={[
        styles.column,
        isEdgeColumn ? styles.edgeColumn : '',
        isDragOver ? styles.columnDragOver : '',
      ].join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>
          {column.title} <span className={styles.count}>{cards.length}</span>
        </h2>

        {isDoneColumn ? (
          <button type="button" onClick={onClearClick} disabled={cards.length === 0}>
            Очистить
          </button>
        ) : (
          <button type="button" onClick={onAddClick}>
            + Добавить
          </button>
        )}
      </header>

      <div className={styles.cards}>
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            onEdit={onEditCard}
            // Какие быстрые кнопки показать, зависит от колонки:
            // ▶ только в «Куче», ✓ и ✕ везде, кроме «Выполнено».
            onStart={isIncomingColumn ? onStartCard : undefined}
            onComplete={isDoneColumn ? undefined : onCompleteCard}
            onRemove={isDoneColumn ? undefined : onRemoveCard}
          />
        ))}

        {cards.length === 0 && (
          <p className={`${styles.empty} ${isDragOver ? styles.emptyDropTarget : ''}`}>Пусто</p>
        )}
      </div>
    </section>
  )

  // Срабатывает много раз в секунду, пока карточку держат над колонкой.
  function handleDragOver(event: DragEvent<HTMLElement>) {
    // Без preventDefault браузер считает, что сюда бросать нельзя.
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    // dragleave приходит и когда курсор просто переходит на дочерний элемент.
    // Сбрасываем подсветку, только если курсор действительно ушёл из колонки.
    const cursorTarget = event.relatedTarget as Node | null
    if (!event.currentTarget.contains(cursorTarget)) {
      setIsDragOver(false)
    }
  }

  // Место в колонке не выбираем: бэкенд сам поставит карточку по сумме доната.
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const cardId = Number(event.dataTransfer.getData('text/plain'))
    if (!cardId) {
      return
    }

    // Бросили в ту же колонку, откуда взяли, — ничего не делаем.
    const isAlreadyHere = cards.some((card) => card.id === cardId)
    if (!isAlreadyHere) {
      onDropCard(cardId, column.id)
    }
  }
}
