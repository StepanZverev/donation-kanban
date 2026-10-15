import type { CSSProperties } from 'react'
import type { PublicCard } from '../../types/card'
import { getCardText, getDonorName } from '../../utils/donor'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import styles from './ViewerCard.module.css'

type ViewerCardProps = {
  card: PublicCard
  priorityLevels: PriorityLevel[]
  // Приглушённая карточка — так выглядят карточки в «Выполнено»
  isMuted: boolean
}

// Карточка на странице для зрителей. Выглядит как у стримера (CardItem),
// но только для чтения: без стрелок, меню и перетаскивания.
export function ViewerCard(props: ViewerCardProps) {
  const { card, priorityLevels, isMuted } = props
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  const text = getCardText(card)

  return (
    <article
      className={`${styles.card} ${isMuted ? styles.muted : ''}`}
      // Цвет уровня приоритета: им красятся полоска слева и сумма
      style={{ '--priority-color': priority.color } as CSSProperties}
    >
      <h3 className={styles.heading}>{getDonorName(card)}</h3>
      {card.amount !== null && (
        <span className={styles.amount}>{formatMoney(card.amount, card.currency)}</span>
      )}
      {text && <p className={styles.text}>{text}</p>}
    </article>
  )
}
