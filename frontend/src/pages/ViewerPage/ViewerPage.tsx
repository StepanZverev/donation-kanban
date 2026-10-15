import { useParams } from 'react-router'
import { usePublicBoard } from '../../hooks/usePublicBoard'
import { ViewerCard } from '../../components/ViewerCard/ViewerCard'
import styles from './ViewerPage.module.css'

// Страница для зрителей: /v/<токен>. Доска стримера только для чтения.
// Входить не нужно, гостя для зрителя не создаём (см. main.tsx).
export function ViewerPage() {
  // Токен — секретная часть ссылки после /v/
  const { token = '' } = useParams()
  const { state, error, getColumnCards } = usePublicBoard(token)

  if (state.status === 'loading') {
    return <p className={styles.message}>Загружаю доску…</p>
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
        <h1 className={styles.title}>
          {board.streamerName ? `Заказы: ${board.streamerName}` : 'Заказы стримера'}
        </h1>

        {/* Кнопка «+» есть, только если стример указал ссылку на донат */}
        {board.donationUrl &&
          (board.intakeOpen ? (
            <div className={styles.suggest}>
              <a
                className={styles.suggestButton}
                href={board.donationUrl}
                // noopener noreferrer: открытая страница не получит доступа к этой вкладке
                target="_blank"
                rel="noopener noreferrer"
              >
                + Предложить задачу
              </a>
              <span className={styles.suggestHint}>Опиши задачу в сообщении к донату</span>
            </div>
          ) : (
            <span className={styles.closed}>Приём заказов закрыт</span>
          ))}
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
