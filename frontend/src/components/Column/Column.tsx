import type { Card } from '../../types/card'
import { CardItem } from '../CardItem/CardItem'
import styles from './Column.module.css'

type ColumnProps = {
  title: string
  cards: Card[]
  onAddClick: () => void
  onEditCard: (card: Card) => void
  onRemoveCard: (card: Card) => void
}

export function Column({ title, cards, onAddClick, onEditCard, onRemoveCard }: ColumnProps) {
  return (
    <section className={styles.column}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {title} <span className={styles.count}>{cards.length}</span>
        </h2>
        <button type="button" onClick={onAddClick}>
          + Добавить
        </button>
      </header>

      <div className={styles.cards}>
        {cards.map((card) => (
          <CardItem key={card.id} card={card} onEdit={onEditCard} onRemove={onRemoveCard} />
        ))}

        {cards.length === 0 && <p className={styles.empty}>Пусто</p>}
      </div>
    </section>
  )
}
