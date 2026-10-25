import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { GLOW_SECONDS, SHOW_UNMERGE } from '../../defaults'
import type { BoardColumn, Card } from '../../types/card'
import { useIsRecent } from '../../hooks/useIsRecent'
import { useTimeAgo } from '../../hooks/useTimeAgo'
import { getCardText, getDonorName } from '../../utils/donor'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import { pluralize } from '../../utils/time'
import { CardMenu } from '../CardMenu/CardMenu'
import { CardText } from '../CardText/CardText'
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons/Icons'
import styles from './CardItem.module.css'

// Что можно сделать с карточкой на доске (и можно ли). Всё собрано в один объект:
// его готовит BoardPage, а Column раздаёт каждой своей карточке.
export type CardActions = {
  // «Изменить» в меню «⋯»: окно с формой
  editCard: (card: Card) => void
  // В другую колонку: стрелками, через меню или перетаскиванием
  moveCard: (cardId: number, columnId: number) => void
  // В историю с пометкой «удалено» или «выполнено»
  deleteCard: (card: Card) => void
  finishCard: (card: Card) => void
  // «Отклонить…» в меню: окно с причиной
  rejectCard: (card: Card) => void
  // Есть ли на доске другие карточки того же донатера, и «Объединить все донаты в эту карточку»
  canMergeAll: (card: Card) => boolean
  mergeAll: (card: Card) => void
  // «Разъединить»: вернуть слитые донаты на доску
  unmerge: (card: Card) => void
  // Можно ли бросить на карточку ту, которую сейчас тащат, чтобы объединить их, и само объединение
  canMergeOnDrop: (card: Card) => boolean
  mergeOnDrop: (card: Card) => void
}

type CardItemProps = {
  card: Card
  // Уровни приоритета из настроек: по ним выбирается цвет полоски слева и суммы
  priorityLevels: PriorityLevel[]
  // Приглушённая карточка — так выглядят карточки в «Выполнено»
  isMuted: boolean
  // Донат пришёл, пока стример был на другой вкладке: карточка мигнёт подсветкой
  isNew: boolean
  // Колонки, в которые карточку можно перенести через меню «⋯»
  moveTargets: BoardColumn[]
  // Соседние колонки для стрелок по бокам. Соседа нет (карточка в крайней колонке) —
  // стрелка слева удаляет карточку (красная), справа — убирает в историю выполненной (зелёная).
  leftColumn: BoardColumn | undefined
  rightColumn: BoardColumn | undefined
  actions: CardActions
}

export function CardItem(props: CardItemProps) {
  const { card, priorityLevels, isMuted, isNew, moveTargets, leftColumn, rightColumn, actions } = props
  const [isDragging, setIsDragging] = useState(false)
  // Держат ли над этой карточкой другую (чтобы показать «+ Объединить»)
  const [isDragOver, setIsDragOver] = useState(false)
  // Длинное сообщение свёрнуто до четырёх строк; «Показать полностью» разворачивает его.
  const [isExpanded, setIsExpanded] = useState(false)
  // Не влез ли текст в четыре строки — тогда под ним нужна ссылка «Показать полностью».
  const [isTextCut, setIsTextCut] = useState(false)
  // Ссылка на абзац с текстом, чтобы померить его высоту
  const textRef = useRef<HTMLDivElement>(null)

  // Цвет полоски и суммы зависит от суммы доната. Ручные карточки считаются суммой 0.
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  // Сверху ник (без ника — «Аноним»), ниже текст
  const heading = getDonorName(card)
  const text = getCardText(card)
  // Можно ли бросить на эту карточку ту, которую сейчас тащат
  const canMergeOnDrop = actions.canMergeOnDrop(card)
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
  const isRecentEvent = useIsRecent(lastEventTime, GLOW_SECONDS * 1000)
  const isGlowing = !isMuted && (isNew || isRecentEvent)
  // Подпись внизу: «3 мин назад · 2 доната»
  const timeAgo = useTimeAgo(lastDonationAt)
  const donationsWord = `${card.mergeCount} ${pluralize(card.mergeCount, ['донат', 'доната', 'донатов'])}`
  // Количество пишем, только когда донатов несколько: «1 донат» ничего не сообщает
  const meta = card.mergeCount > 1 ? `${timeAgo} · ${donationsWord}` : timeAgo

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
        className={`${styles.arrow} ${leftColumn ? '' : styles.danger}`}
        title={leftColumn ? 'В колонку слева' : 'Удалить'}
        onClick={handleLeftClick}
      >
        <ChevronLeftIcon />
      </button>

      <div className={styles.content}>
        {/* Шапка: ник, под ним сумма, справа меню «⋯» — как в заголовке колонки */}
        <header className={styles.header}>
          <div className={styles.titleLine}>
            <h3 className={styles.heading} title={heading}>
              {heading}
            </h3>
            {card.amount !== null && (
              <span className={styles.amount}>{formatMoney(card.amount, card.currency)}</span>
            )}
          </div>
          <div className={styles.menuSlot}>
            <CardMenu
              moveTargets={moveTargets}
              onEdit={handleEdit}
              onMove={handleMove}
              onDelete={handleDelete}
              onReject={handleReject}
              onMergeAll={actions.canMergeAll(card) ? handleMergeAll : undefined}
              onUnmerge={SHOW_UNMERGE && isMerged ? handleUnmerge : undefined}
            />
          </div>
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
              <CardText text={text} />
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
        className={`${styles.arrow} ${rightColumn ? '' : styles.success}`}
        title={rightColumn ? 'В колонку справа' : 'Выполнено, убрать в историю'}
        onClick={handleRightClick}
      >
        <ChevronRightIcon />
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
    actions.mergeOnDrop(card)
  }

  function handleExpandClick() {
    setIsExpanded(!isExpanded)
  }

  function handleMergeAll() {
    actions.mergeAll(card)
  }

  function handleUnmerge() {
    actions.unmerge(card)
  }

  // Стрелка влево: в соседнюю колонку слева, а из «Очереди» — удалить
  function handleLeftClick() {
    if (leftColumn) {
      actions.moveCard(card.id, leftColumn.id)
    } else {
      actions.deleteCard(card)
    }
  }

  // Стрелка вправо: в соседнюю колонку справа, а из «Выполнено» — в историю как выполненную
  function handleRightClick() {
    if (rightColumn) {
      actions.moveCard(card.id, rightColumn.id)
    } else {
      actions.finishCard(card)
    }
  }

  function handleEdit() {
    actions.editCard(card)
  }

  function handleMove(columnId: number) {
    actions.moveCard(card.id, columnId)
  }

  function handleDelete() {
    actions.deleteCard(card)
  }

  function handleReject() {
    actions.rejectCard(card)
  }
}
