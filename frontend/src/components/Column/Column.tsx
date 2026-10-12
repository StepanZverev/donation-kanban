import { useState, type DragEvent } from 'react'
import type { Card, CardStatus } from '../../types/card'
import { CardItem } from '../CardItem/CardItem'
import styles from './Column.module.css'

type ColumnProps = {
  title: string
  status: CardStatus
  cards: Card[]
  onAddClick: () => void
  onEditCard: (card: Card) => void
  onRemoveCard: (card: Card) => void
  onDropCard: (cardId: number, status: CardStatus, position: number) => void
}

export function Column({
  title,
  status,
  cards,
  onAddClick,
  onEditCard,
  onRemoveCard,
  onDropCard,
}: ColumnProps) {
  // Куда встанет карточка, если её сейчас отпустить (0 — самый верх).
  // null — над этой колонкой сейчас ничего не тащат.
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  return (
    <section
      className={`${styles.column} ${dropIndex !== null ? styles.columnDragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>
          {title} <span className={styles.count}>{cards.length}</span>
        </h2>
        <button type="button" onClick={onAddClick}>
          + Добавить
        </button>
      </header>

      <div className={styles.cards}>
        {cards.map((card, index) => (
          <div key={card.id} className={getSlotClassName(index)}>
            <CardItem card={card} onEdit={onEditCard} onRemove={onRemoveCard} />
          </div>
        ))}

        {cards.length === 0 && (
          <p className={`${styles.empty} ${dropIndex !== null ? styles.emptyDropTarget : ''}`}>
            Пусто
          </p>
        )}
      </div>
    </section>
  )

  // Линию «сюда встанет карточка» рисуем над нужной карточкой (или под последней)
  // через CSS, чтобы она не сдвигала карточки и не сбивала расчёт позиции.
  function getSlotClassName(index: number) {
    if (dropIndex === index) {
      return `${styles.slot} ${styles.dropBefore}`
    }
    if (dropIndex === cards.length && index === cards.length - 1) {
      return `${styles.slot} ${styles.dropAfter}`
    }
    return styles.slot
  }

  // Срабатывает много раз в секунду, пока карточку держат над колонкой.
  function handleDragOver(event: DragEvent<HTMLElement>) {
    // Без preventDefault браузер считает, что сюда бросать нельзя.
    event.preventDefault()
    setDropIndex(getDropIndex(event))
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    // dragleave приходит и когда курсор просто переходит на дочерний элемент.
    // Сбрасываем подсветку, только если курсор действительно ушёл из колонки.
    const cursorTarget = event.relatedTarget as Node | null
    if (!event.currentTarget.contains(cursorTarget)) {
      setDropIndex(null)
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const cardId = Number(event.dataTransfer.getData('text/plain'))
    let position = getDropIndex(event)
    setDropIndex(null)

    if (!cardId) {
      return
    }

    // Если карточку двигают вниз внутри этой же колонки, то после того как её
    // вынут со старого места, всё, что ниже, сдвинется на одну позицию вверх.
    const currentIndex = cards.findIndex((card) => card.id === cardId)
    if (currentIndex !== -1 && currentIndex < position) {
      position -= 1
    }
    // Бросили на то же место — ничего не делаем.
    if (currentIndex === position) {
      return
    }

    onDropCard(cardId, status, position)
  }

  // Считает место вставки по высоте курсора: карточка встанет перед первой
  // карточкой, середина которой ниже курсора.
  function getDropIndex(event: DragEvent<HTMLElement>) {
    const cardElements = event.currentTarget.querySelectorAll('[data-card-id]')
    for (let index = 0; index < cardElements.length; index++) {
      const rect = cardElements[index].getBoundingClientRect()
      if (event.clientY < rect.top + rect.height / 2) {
        return index
      }
    }
    return cardElements.length
  }
}
