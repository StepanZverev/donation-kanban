import { RestoreIcon, TrashIcon } from '../../components/Icons/Icons'
import { useHistoryCards } from '../../hooks/useHistoryCards'
import type { Card } from '../../types/card'
import styles from './HistoryPage.module.css'

const archiveReasonLabels = {
  done: 'Выполнена',
  deleted: 'Удалена',
}

export function HistoryPage() {
  const { cards, isLoading, error, restoreCard, deleteForever } = useHistoryCards()

  if (isLoading) {
    return <p>Загружаю историю…</p>
  }

  return (
    <div className={styles.page}>
      {error && <p className={styles.error}>{error}</p>}

      {cards.length === 0 && <p className={styles.empty}>В истории пока ничего нет</p>}

      <ul className={styles.list}>
        {cards.map((card) => (
          <li key={card.id} className={styles.item}>
            <div className={styles.info}>
              <p className={styles.meta}>
                {card.archiveReason && (
                  <span className={`${styles.badge} ${styles[card.archiveReason]}`}>
                    {archiveReasonLabels[card.archiveReason]}
                  </span>
                )}
                {card.archivedAt && formatDate(card.archivedAt)}
                {card.source === 'donationalerts' &&
                  ` · ${card.donorName} · ${card.amount} ${card.currency}`}
              </p>
              <h3 className={styles.title}>{card.title}</h3>
              {card.description && <p className={styles.description}>{card.description}</p>}
            </div>

            {/* Кнопки-иконки; подпись видна во всплывающей подсказке (title) */}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconButton}
                title="Переоткрыть"
                aria-label="Переоткрыть"
                onClick={() => handleRestore(card)}
              >
                <RestoreIcon />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.dangerButton}`}
                title="Удалить навсегда"
                aria-label="Удалить навсегда"
                onClick={() => handleDeleteForever(card)}
              >
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

  function handleRestore(card: Card) {
    restoreCard(card.id)
  }

  function handleDeleteForever(card: Card) {
    if (window.confirm(`Удалить «${card.title}» навсегда? Вернуть будет нельзя.`)) {
      deleteForever(card.id)
    }
  }
}

// '2026-10-12T13:04:13+00:00' → '12.10.2026, 16:04' (в часовом поясе пользователя)
function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
