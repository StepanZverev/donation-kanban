import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import type { BoardColumn, Card } from '../../types/card'
import { useNow } from '../../hooks/useNow'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import { formatTimeAgo, pluralize } from '../../utils/time'
import { CardMenu } from '../CardMenu/CardMenu'
import styles from './CardItem.module.css'

// Этой строкой бэкенд разделяет тексты объединённых донатов (MERGE_SEPARATOR в merging.py).
// На карточке вместо неё рисуем пунктирную линию.
const MERGE_SEPARATOR = '\n⸻\n'

// Пункт «Разъединить» в меню «⋯» пока спрятан: стримеру он не нужен.
// Сама функция осталась, чтобы вернуть пункт, достаточно поставить true.
const SHOW_UNMERGE = false

// Сколько секунд карточка светится после нового доната или слияния
const GLOW_SECONDS = 5

type CardItemProps = {
  card: Card
  // Уровни приоритета из настроек: по ним выбирается цвет полоски слева и суммы
  priorityLevels: PriorityLevel[]
  // Приглушённая карточка — так выглядят карточки в «Выполнено»
  isMuted: boolean
  // Колонки, в которые карточку можно перенести через меню «⋯»
  moveTargets: BoardColumn[]
  onEdit: (card: Card) => void
  onMove: (cardId: number, columnId: number) => void
  onDelete: (card: Card) => void
  onReject: (card: Card) => void
  // Есть ли у донатера другие карточки, которые можно слить в эту
  canMergeAll: boolean
  onMergeAll: (card: Card) => void
  // «Разъединить»: вернуть слитые донаты на доску
  onUnmerge: (card: Card) => void
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
    isMuted,
    moveTargets,
    onEdit,
    onMove,
    onDelete,
    onReject,
    canMergeAll,
    onMergeAll,
    onUnmerge,
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
  // Текущее время раз в секунду — чтобы «40 сек назад» обновлялось само
  // и подсветка гасла вовремя
  const now = useNow(1000)

  const isDonation = card.source === 'donationalerts'
  // Цвет полоски и суммы зависит от суммы доната. Ручные карточки считаются суммой 0.
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  // У доната заголовок — это обрезанное начало сообщения, а целиком оно лежит в описании.
  // Показываем сообщение один раз: описание, а если его нет — заголовок.
  const heading = isDonation ? card.donorName : card.title
  const text = isDonation ? card.description || card.title : card.description
  // Тексты объединённых донатов по отдельности: между ними нарисуем пунктир
  const textParts = text.split(MERGE_SEPARATOR)
  // Обводку «+ Объединить» показываем, только пока над карточкой держат подходящую
  const showMergeDrop = isDragOver && canMergeOnDrop
  // В карточку слиты другие донаты
  const isMerged = card.mergeCount > 1
  // Когда пришёл последний донат: у ручной карточки — когда её создали
  const lastDonationAt = card.lastDonationAt ?? card.createdAt
  // Новый донат или слияние подсвечиваем, чтобы стример заметил. В «Выполнено» не нужно.
  // Отсчёт идёт от того, что случилось позже.
  const lastEventTime = Math.max(
    new Date(lastDonationAt).getTime(),
    card.lastMergedAt ? new Date(card.lastMergedAt).getTime() : 0,
  )
  const isGlowing = !isMuted && now - lastEventTime < GLOW_SECONDS * 1000
  // Подпись внизу: «3 мин назад · 2 доната»
  const donationsWord = `${card.mergeCount} ${pluralize(card.mergeCount, ['донат', 'доната', 'донатов'])}`
  const meta = isDonation
    ? `${formatTimeAgo(lastDonationAt, now)} · ${donationsWord}`
    : formatTimeAgo(lastDonationAt, now)

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
      className={[
        styles.card,
        isDragging ? styles.dragging : '',
        showMergeDrop ? styles.mergeDrop : '',
        isGlowing ? styles.fresh : '',
        isMuted ? styles.muted : '',
      ].join(' ')}
      // CSS-переменная с цветом уровня: ей красятся полоска слева и сумма (CardItem.module.css)
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
              onReject={handleReject}
              onMergeAll={canMergeAll ? handleMergeAll : undefined}
              onUnmerge={SHOW_UNMERGE && isMerged ? handleUnmerge : undefined}
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

        {/* В «Выполнено» время уже не важно */}
        {!isMuted && <p className={styles.meta}>{meta}</p>}
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

  function handleMergeAll() {
    onMergeAll(card)
  }

  function handleUnmerge() {
    onUnmerge(card)
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

  function handleReject() {
    onReject(card)
  }
}
