import { useParams } from 'react-router'
import { useCardFlash } from '../../hooks/useCardFlash'
import { useFollowedDonor } from '../../hooks/useFollowedDonor'
import { usePublicBoard } from '../../hooks/usePublicBoard'
import { FollowPanel } from '../../components/FollowPanel/FollowPanel'
import { OrderRules } from '../../components/OrderRules/OrderRules'
import { ViewerCard } from '../../components/ViewerCard/ViewerCard'
import { ViewerHeader } from '../../components/ViewerHeader/ViewerHeader'
import { isFollowedDonor } from '../../utils/follow'
import styles from './ViewerPage.module.css'

// Страница для зрителей: /v/<токен>. Доска стримера только для чтения.
// Входить не нужно, гостя для зрителя не создаём (см. main.tsx).
export function ViewerPage() {
  // Токен — секретная часть ссылки после /v/
  const { token = '' } = useParams()
  const { state, error, getColumnCards } = usePublicBoard(token)
  const { followedName, follow, unfollow } = useFollowedDonor(token)
  const { flashedCardId, showCard } = useCardFlash()

  if (state.status === 'loading') {
    // Первая загрузка не удалась — показываем ошибку, а не вечное «Загружаю»
    const message = error ? 'Не удалось загрузить доску. Попробуй обновить страницу.' : 'Загружаю доску…'
    return <p className={styles.message}>{message}</p>
  }

  if (state.status === 'broken') {
    return (
      <p className={styles.message}>
        Ссылка не работает: стример её выключил или заменил на новую.
      </p>
    )
  }

  const { board } = state

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <ViewerHeader board={board} />
        <OrderRules board={board} />
        {followedName && (
          <FollowPanel
            board={board}
            followedName={followedName}
            getColumnCards={getColumnCards}
            onUnfollow={unfollow}
            onShowCard={showCard}
          />
        )}
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.board}>
        {board.columns.map((column) => {
          const cards = getColumnCards(column.id)
          return (
            <section key={column.id} className={styles.column}>
              <h2 className={styles.columnTitle}>
                {column.title} <span className={styles.count}>{cards.length}</span>
              </h2>
              {cards.map((card) => (
                <ViewerCard
                  key={card.id}
                  card={card}
                  priorityLevels={board.priorityLevels}
                  isMuted={column.kind === 'done'}
                  isFollowed={followedName !== null && isFollowedDonor(card, followedName)}
                  isFlashed={card.id === flashedCardId}
                  onFollow={follow}
                />
              ))}
              {cards.length === 0 && <p className={styles.empty}>Пока пусто</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
