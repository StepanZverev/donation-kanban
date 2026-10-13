import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import { CardMenu } from '../CardMenu/CardMenu'
import styles from './CardItem.module.css'

// Сколько подсвечивать карточку, в которую только что слили донат
const MERGE_HIGHLIGHT_MS = 6000

// Этой строкой бэкенд разделяет тексты объединённых донатов (MERGE_SEPARATOR в merging.py).
// На карточке вместо неё рисуем пунктирную линию.
const MERGE_SEPARATOR = '\n⸻\n'

type CardItemProps = {
  card: Card
  // Уровни приоритета из настроек: по ним выбирается цвет обводки
  priorityLevels: PriorityLevel[]
  // Колонки, в которые карточку можно перенести через меню «⋯»
  moveTargets: BoardColumn[]
  onEdit: (card: Card) => void
  onMove: (cardId: number, columnId: number) => void
  onDelete: (card: Card) => void
  // Есть ли у донатера другая карточка, с которой эту можно объединить
  canMerge: boolean
  onMerge: (card: Card) => void
  // Можно ли бросить на эту карточку ту, которую сейчас тащат, чтобы объединить их
  canMergeOnDrop: boolean
  onMergeDrop: (card: Card) => void
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
    canMerge,
    onMerge,
    canMergeOnDrop,
    onMergeDrop,
    leftArrow,
    rightArrow,
    onLeftClick,
    onRightClick,
  } = props
  const [isDragging, setIsDragging] = useState(false)
  // Держат ли над этой карточкой другую (чтобы показать «+ Объединить»)
  const [isDragOver, setIsDragOver] = useState(false)
  // Длинное сообщение свёрнуто до трёх строк; «Показать полностью» разворачивает его.
  const [isExpanded, setIsExpanded] = useState(false)
  // Не влез ли текст в три строки — тогда под ним нужна ссылка «Показать полностью».
  const [isTextCut, setIsTextCut] = useState(false)
  // Ссылка на абзац с текстом, чтобы померить его высоту
  const textRef = useRef<HTMLDivElement>(null)
  // Время слияния, подсветка которого уже погасла (его выставляет таймер ниже)
  const [expiredMergeAt, setExpiredMergeAt] = useState<string | null>(null)

  const isDonation = card.source === 'donationalerts'
  // Цвет обводки зависит от суммы доната. Ручные карточки считаются суммой 0.
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  // У доната заголовок — это обрезанное начало сообщения, а целиком оно лежит в описании.
  // Показываем сообщение один раз: описание, а если его нет — заголовок.
  const heading = isDonation ? card.donorName : card.title
  const text = isDonation ? card.description || card.title : card.description
  // Тексты объединённых донатов по отдельности: между ними нарисуем пунктир
  const textParts = text.split(MERGE_SEPARATOR)
  // Обводку «+ Объединить» показываем, только пока над карточкой держат подходящую
  const showMergeDrop = isDragOver && canMergeOnDrop

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

  // В карточку только что слили донат: несколько секунд подсвечиваем её и показываем «+300 ₽ от Васи»
  const isJustMerged =
    card.lastMergedAt !== null &&
    card.lastMergedAt !== expiredMergeAt &&
    getMsSince(card.lastMergedAt) < MERGE_HIGHLIGHT_MS

  // Гасим подсветку, когда пройдёт MERGE_HIGHLIGHT_MS с момента слияния
  useEffect(() => {
    const mergedAt = card.lastMergedAt
    if (!mergedAt) {
      return
    }
    const timeLeftMs = MERGE_HIGHLIGHT_MS - getMsSince(mergedAt)
    if (timeLeftMs <= 0) {
      return
    }
    const timer = window.setTimeout(() => setExpiredMergeAt(mergedAt), timeLeftMs)
    return () => window.clearTimeout(timer)
  }, [card.lastMergedAt])

  return (
    <article
      className={[
        styles.card,
        isDragging ? styles.dragging : '',
        isJustMerged ? styles.justMerged : '',
        showMergeDrop ? styles.mergeDrop : '',
      ].join(' ')}
      // CSS-переменная с цветом уровня, её использует .card в CardItem.module.css
      style={{ '--priority-color': priority.color } as CSSProperties}
      data-card-id={card.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
              onMerge={canMerge ? handleMergeClick : undefined}
            />
          </div>
          {card.amount !== null && (
            <span className={styles.amount}>{formatMoney(card.amount, card.currency)}</span>
          )}
        </header>

        {isJustMerged && card.lastMergeNote && <p className={styles.mergeNote}>{card.lastMergeNote}</p>}

        {/* Текст и ссылка под ним работают как одно целое: клик по любому из них
            раскрывает или сворачивает текст (клик по ссылке доходит сюда же),
            а наведение на текст подчёркивает ссылку. */}
        {text && (
          <div
            className={isTextCut ? styles.expandable : undefined}
            onClick={isTextCut ? handleExpandClick : undefined}
          >
            <div ref={textRef} className={`${styles.text} ${isExpanded ? '' : styles.collapsed}`}>
              {textParts.map((part, index) => (
                // Индекс как key подходит: части не переставляются, только дописываются в конец
                <span key={index}>
                  {index > 0 && <span className={styles.separator} />}
                  {part}
                </span>
              ))}
            </div>

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

      {/* Подсказка поверх карточки: отпустишь — объединятся */}
      {showMergeDrop && (
        <div className={styles.mergeDropHint}>
          <span className={styles.mergeDropPlus}>+</span>
          Объединить
        </div>
      )}
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

  // Над карточкой держат другую. Если их можно объединить — разрешаем бросить сюда
  // (preventDefault) и показываем «+ Объединить». Колонка видит defaultPrevented
  // и не подсвечивает себя: бросают не в неё, а на карточку.
  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!canMergeOnDrop) {
      return
    }
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    // Как в колонке: переход курсора на дочерний элемент — ещё не уход с карточки
    const cursorTarget = event.relatedTarget as Node | null
    if (!event.currentTarget.contains(cursorTarget)) {
      setIsDragOver(false)
    }
  }

  // Отпустили карточку на эту — объединяем. stopPropagation: чтобы колонка
  // не приняла бросок как перенос карточки к себе.
  function handleDrop(event: DragEvent<HTMLElement>) {
    setIsDragOver(false)
    if (!canMergeOnDrop) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onMergeDrop(card)
  }

  function handleExpandClick() {
    setIsExpanded(!isExpanded)
  }

  function handleMergeClick() {
    onMerge(card)
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

// Сколько миллисекунд прошло с момента isoDate (например, '2026-10-13T12:00:00.000+00:00')
function getMsSince(isoDate: string) {
  return Date.now() - Date.parse(isoDate)
}
