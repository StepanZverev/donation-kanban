import { useState, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import type { PriorityLevel } from '../../utils/priority'
import { CardItem } from '../CardItem/CardItem'
import styles from './Column.module.css'

type ColumnProps = {
  column: BoardColumn
  // Все колонки доски — для пункта «Переместить в…» в меню карточки
  allColumns: BoardColumn[]
  cards: Card[]
  // Уровни приоритета для цвета обводки карточек
  priorityLevels: PriorityLevel[]
  onAddClick: () => void
  onEditCard: (card: Card) => void
  // В историю с пометкой «удалено» / «выполнено»
  onDeleteCard: (card: Card) => void
  onFinishCard: (card: Card) => void
  onDropCard: (cardId: number, columnId: number) => void
  // Можно ли объединить карточку с другой карточкой того же донатера, и само объединение
  canMerge: (card: Card) => boolean
  onMergeCard: (card: Card) => void
  onClearClick: () => void
}

export function Column(props: ColumnProps) {
  const {
    column,
    allColumns,
    cards,
    priorityLevels,
    onAddClick,
    onEditCard,
    onDeleteCard,
    onFinishCard,
    onDropCard,
    canMerge,
    onMergeCard,
    onClearClick,
  } = props
  // Держат ли сейчас карточку над этой колонкой (чтобы подсветить её).
  const [isDragOver, setIsDragOver] = useState(false)
  const isIncomingColumn = column.kind === 'incoming'
  const isDoneColumn = column.kind === 'done'
  // «Очередь» и «Выполнено» стоят по краям и выглядят иначе, чем промежуточные колонки.
  const isEdgeColumn = isIncomingColumn || isDoneColumn
  // Куда можно перенести карточку из этой колонки через меню: в любую другую.
  const moveTargets = allColumns.filter((otherColumn) => otherColumn.id !== column.id)
  // Соседние колонки для стрелок ‹ › на карточке. У крайних колонок соседа нет:
  // стрелка влево из «Очереди» удаляет карточку, стрелка вправо из «Выполнено» отправляет в историю.
  const columnIndex = allColumns.findIndex((otherColumn) => otherColumn.id === column.id)
  const leftColumn = allColumns[columnIndex - 1]
  const rightColumn = allColumns[columnIndex + 1]

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
            priorityLevels={priorityLevels}
            moveTargets={moveTargets}
            onEdit={onEditCard}
            onMove={onDropCard}
            onDelete={onDeleteCard}
            canMerge={canMerge(card)}
            onMerge={onMergeCard}
            leftArrow={leftColumn ? 'move' : 'delete'}
            rightArrow={rightColumn ? 'move' : 'finish'}
            onLeftClick={handleLeftClick}
            onRightClick={handleRightClick}
          />
        ))}

        {cards.length === 0 && (
          <p className={`${styles.empty} ${isDragOver ? styles.emptyDropTarget : ''}`}>Пусто</p>
        )}
      </div>
    </section>
  )

  // Стрелка влево: в соседнюю колонку слева, а из «Очереди» — удалить.
  function handleLeftClick(card: Card) {
    if (leftColumn) {
      onDropCard(card.id, leftColumn.id)
    } else {
      onDeleteCard(card)
    }
  }

  // Стрелка вправо: в соседнюю колонку справа, а из «Выполнено» — в историю как выполненную.
  function handleRightClick(card: Card) {
    if (rightColumn) {
      onDropCard(card.id, rightColumn.id)
    } else {
      onFinishCard(card)
    }
  }

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
