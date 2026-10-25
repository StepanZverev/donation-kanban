import { useState, type DragEvent } from 'react'
import { STREAMER_CURRENCY } from '../../defaults'
import type { BoardColumn, Card, ColumnKind } from '../../types/card'
import type { PriorityLevel } from '../../utils/priority'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import { CardItem, type CardActions } from '../CardItem/CardItem'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import { BroomIcon, PlusIcon } from '../Icons/Icons'
import styles from './Column.module.css'

// Подсказка в пустой колонке: что сюда попадает
const emptyHints: Record<ColumnKind, string> = {
  incoming: 'Здесь появятся новые донаты',
  work: 'Перетащи сюда карточку, за которую взялся',
  done: 'Перетащи сюда то, что уже сделал',
}

type ColumnProps = {
  column: BoardColumn
  // Все колонки доски — для пункта «Переместить в…» в меню карточки
  allColumns: BoardColumn[]
  cards: Card[]
  // Уровни приоритета для цвета обводки карточек
  priorityLevels: PriorityLevel[]
  // Что можно сделать с карточками (см. CardActions в CardItem)
  cardActions: CardActions
  // Пришёл ли донат карточки, пока стример был на другой вкладке (тогда она мигнёт)
  isNewCard: (card: Card) => boolean
  onAddClick: () => void
  // «Очистить» есть только у «Очереди» и «Выполнено»
  onClearClick: () => void
}

export function Column(props: ColumnProps) {
  const { column, allColumns, cards, priorityLevels, cardActions, isNewCard, onAddClick, onClearClick } = props
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
  // Сумма всех карточек колонки в валюте стримера. Ручные карточки без суммы считаются нулём.
  const columnSum = cards.reduce((sum, card) => sum + (card.streamerAmount ?? 0), 0)
  const cardsWord = `${cards.length} ${pluralize(cards.length, ['карточку', 'карточки', 'карточек'])}`

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
      {/* Шапка не прокручивается вместе с карточками: кнопки всегда под рукой */}
      <header className={styles.header}>
        <h2 className={styles.title}>
          {column.title} <span className={styles.count}>{cards.length}</span>
        </h2>
        <p className={styles.sum}>{formatMoney(columnSum, STREAMER_CURRENCY)}</p>

        <div className={styles.actions}>
          {!isDoneColumn && (
            <button
              type="button"
              className={styles.iconButton}
              title="Добавить вручную"
              aria-label="Добавить вручную"
              onClick={onAddClick}
            >
              <PlusIcon />
            </button>
          )}

          {isEdgeColumn && (
            <ConfirmButton
              className={styles.iconButton}
              title={isIncomingColumn ? 'Очистить очередь' : 'Очистить выполненные'}
              question={
                <>
                  Убрать <b>{cardsWord}</b> {isIncomingColumn ? 'из очереди' : 'из выполненных'} в историю?
                </>
              }
              confirmLabel="Очистить"
              onConfirm={onClearClick}
              disabled={cards.length === 0}
            >
              <BroomIcon />
            </ConfirmButton>
          )}
        </div>
      </header>

      <div className={styles.cards}>
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            priorityLevels={priorityLevels}
            isMuted={isDoneColumn}
            isNew={isNewCard(card)}
            moveTargets={moveTargets}
            leftColumn={leftColumn}
            rightColumn={rightColumn}
            actions={cardActions}
          />
        ))}

        {cards.length === 0 && (
          <p className={`${styles.empty} ${isDragOver ? styles.emptyDropTarget : ''}`}>
            {isDragOver ? 'Отпусти, чтобы положить сюда' : emptyHints[column.kind]}
          </p>
        )}
      </div>
    </section>
  )

  // Срабатывает много раз в секунду, пока карточку держат над колонкой.
  function handleDragOver(event: DragEvent<HTMLElement>) {
    // Карточку держат над другой карточкой, и та уже приняла её для объединения
    // (см. handleDragOver в CardItem). Тогда колонку не подсвечиваем.
    if (event.defaultPrevented) {
      setIsDragOver(false)
      return
    }
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
      cardActions.moveCard(cardId, column.id)
    }
  }
}
