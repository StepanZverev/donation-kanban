import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import { CardMenu } from '../CardMenu/CardMenu'
import styles from './CardItem.module.css'

type CardItemProps = {
  card: Card
  // Уровни приоритета из настроек: по ним выбирается цвет обводки
  priorityLevels: PriorityLevel[]
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
    priorityLevels,
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
  // Длинное сообщение свёрнуто до трёх строк; «Показать полностью» разворачивает его.
  const [isExpanded, setIsExpanded] = useState(false)
  // Не влез ли текст в три строки — тогда под ним нужна ссылка «Показать полностью».
  const [isTextCut, setIsTextCut] = useState(false)
  // Ссылка на абзац с текстом, чтобы померить его высоту
  const textRef = useRef<HTMLParagraphElement>(null)

  const isDonation = card.source === 'donationalerts'
  // Цвет обводки зависит от суммы доната. Ручные карточки считаются суммой 0.
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  // У доната заголовок — это обрезанное начало сообщения, а целиком оно лежит в описании.
  // Показываем сообщение один раз: описание, а если его нет — заголовок.
  const heading = isDonation ? card.donorName : card.title
  const text = isDonation ? card.description || card.title : card.description

  // Меряем, обрезан ли текст. Делаем это, пока он свёрнут: у обрезанного полная высота
  // (scrollHeight) больше видимой (clientHeight). ResizeObserver перемеряет,
  // когда меняется ширина колонки, например при изменении размера окна.
  useEffect(() => {
    const element = textRef.current
    if (!element || isExpanded) {
      return
    }
    const observer = new ResizeObserver(() => {
      setIsTextCut(element.scrollHeight > element.clientHeight)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [isExpanded, text])

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
          <h3 className={styles.heading} title={heading ?? undefined}>
            {heading}
          </h3>
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

        {/* Текст и ссылка под ним работают как одно целое: клик по любому из них
            раскрывает или сворачивает текст (клик по ссылке доходит сюда же),
            а наведение на текст подчёркивает ссылку. */}
        {text && (
          <div
            className={isTextCut ? styles.expandable : undefined}
            onClick={isTextCut ? handleExpandClick : undefined}
          >
            <p ref={textRef} className={`${styles.text} ${isExpanded ? '' : styles.collapsed}`}>
              {text}
            </p>

            {isTextCut && (
              <button type="button" className={styles.expandButton}>
                {isExpanded ? 'Свернуть' : 'Показать полностью'}
              </button>
            )}
          </div>
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

  function handleExpandClick() {
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
