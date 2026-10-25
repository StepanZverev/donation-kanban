import type { CSSProperties } from 'react'
import type { PublicCard } from '../../types/card'
import { getCardText, getDonorName } from '../../utils/donor'
import { getCardElementId } from '../../utils/follow'
import { formatMoney } from '../../utils/money'
import { getPriorityLevel, type PriorityLevel } from '../../utils/priority'
import { CardText } from '../CardText/CardText'
import { EyeIcon } from '../Icons/Icons'
import styles from './ViewerCard.module.css'

type ViewerCardProps = {
  card: PublicCard
  priorityLevels: PriorityLevel[]
  // Приглушённая карточка — так выглядят карточки в «Выполнено»
  isMuted: boolean
  // Зритель следит за ником этой карточки: рамка и метка «Слежу»
  isFollowed: boolean
  // Подсветка после «Показать на доске»
  isFlashed: boolean
  // «Следить» за ником карточки. У анонимов ника нет — за ними не следим.
  onFollow: (donorName: string) => void
}

// Карточка на странице для зрителей. Выглядит как у стримера (CardItem),
// но только для чтения: без стрелок, меню и перетаскивания.
export function ViewerCard(props: ViewerCardProps) {
  const { card, priorityLevels, isMuted, isFollowed, isFlashed, onFollow } = props
  const priority = getPriorityLevel(card.streamerAmount ?? 0, priorityLevels)
  const text = getCardText(card)
  const className = [
    styles.card,
    isMuted ? styles.muted : '',
    isFollowed ? styles.followed : '',
    isFlashed ? styles.flashed : '',
  ].join(' ')

  return (
    <article
      id={getCardElementId(card.id)}
      className={className}
      // Цвет уровня приоритета: им красятся полоска слева и сумма
      style={{ '--priority-color': priority.color } as CSSProperties}
    >
      <div className={styles.top}>
        <h3 className={styles.heading}>{getDonorName(card)}</h3>
        {isFollowed ? (
          <span className={styles.followedTag}>
            <EyeIcon />
            Слежу
          </span>
        ) : (
          card.donorName && (
            <button className={styles.followButton} type="button" onClick={handleFollowClick}>
              <EyeIcon />
              Следить
            </button>
          )
        )}
      </div>
      {card.amount !== null && (
        <span className={styles.amount}>{formatMoney(card.amount, card.currency)}</span>
      )}
      {text && (
        <p className={styles.text}>
          <CardText text={text} />
        </p>
      )}
    </article>
  )

  function handleFollowClick() {
    if (card.donorName) {
      onFollow(card.donorName)
    }
  }
}
