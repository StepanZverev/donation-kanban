import type { HistoryFilter } from '../../api/history'
import { RestoreIcon, TrashIcon } from '../../components/Icons/Icons'
import { useHistoryCards } from '../../hooks/useHistoryCards'
import { useNow } from '../../hooks/useNow'
import type { Card } from '../../types/card'
import { groupByDay } from '../../utils/historyDays'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import styles from './HistoryPage.module.css'

// Кнопки фильтра над историей, в том порядке, в каком они стоят на экране
const FILTERS: { reason: HistoryFilter['reason']; label: string }[] = [
  { reason: null, label: 'Все' },
  { reason: 'done', label: 'Выполнено' },
  { reason: 'rejected', label: 'Отклонено' },
  { reason: 'deleted', label: 'Удалено' },
  { reason: 'merged', label: 'Объединено' },
]

const archiveReasonLabels = {
  done: 'Выполнено',
  rejected: 'Отклонено',
  deleted: 'Удалено',
  merged: 'Объединено',
}

// Вкладка «История»: фильтр и поиск сверху, ниже карточки по дням с итогом за день.
export function HistoryPage() {
  const {
    cards,
    isLoading,
    error,
    reason,
    setReason,
    query,
    setQuery,
    isFiltered,
    restoreCard,
    deleteForever,
  } = useHistoryCards()
  // Текущее время раз в минуту: чтобы после полуночи «Сегодня» стало «Вчера»
  const now = useNow(60_000)

  if (isLoading) {
    return <p>Загружаю историю…</p>
  }

  const days = groupByDay(cards, new Date(now))

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="radiogroup" aria-label="Что показать">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              role="radio"
              aria-checked={reason === filter.reason}
              className={reason === filter.reason ? `${styles.chip} ${styles.chipSelected}` : styles.chip}
              onClick={() => setReason(filter.reason)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <input
          autoComplete="off"
          type="search"
          className={styles.search}
          placeholder="Поиск по нику или тексту…"
          aria-label="Поиск по нику или тексту"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Прокручивается только список, фильтр и поиск остаются на месте */}
      <div className={styles.list}>
        {cards.length === 0 && (
          <p className={styles.empty}>{isFiltered ? 'Ничего не нашлось' : 'В истории пока ничего нет'}</p>
        )}

        {days.map((day) => (
          <section key={day.key} className={styles.day}>
            <header className={styles.dayHeader}>
              <h2 className={styles.dayTitle}>{day.label}</h2>
              {day.donationCount > 0 && (
                <span>
                  {day.donationCount} {pluralize(day.donationCount, ['донат', 'доната', 'донатов'])}
                </span>
              )}
              {day.total > 0 && <span className={styles.dayTotal}>{formatMoney(day.total, 'RUB')}</span>}
            </header>

            <ul className={styles.rows}>
              {day.cards.map((card) => (
                <li key={card.id} className={styles.row}>
                  <span className={styles.time}>{card.archivedAt && formatTime(card.archivedAt)}</span>

                  {card.archiveReason && (
                    <span className={`${styles.badge} ${styles[card.archiveReason]}`}>
                      {archiveReasonLabels[card.archiveReason]}
                    </span>
                  )}

                  {/* Длинный текст обрезается многоточием, целиком — во всплывающей подсказке */}
                  <span className={styles.what} title={getFullText(card)}>
                    {card.source === 'donationalerts' && <b className={styles.who}>{card.donorName}</b>}
                    {card.source === 'donationalerts' && ' · '}
                    {getText(card)}
                  </span>

                  <span className={styles.amount}>
                    {card.amount !== null && formatMoney(card.amount, card.currency)}
                  </span>

                  {/* Кнопки-иконки; подпись видна во всплывающей подсказке (title) */}
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Вернуть на доску"
                      aria-label="Вернуть на доску"
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
                  </span>

                  {/* Причина отказа — отдельной строкой под текстом */}
                  {card.archiveReason === 'rejected' && card.archiveNote && (
                    <span className={styles.note}>Причина: {card.archiveNote}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
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

// Что показать в строке после ника. У доната заголовок — обрезанное начало сообщения,
// а целиком оно в описании. У ручной карточки — заголовок.
function getText(card: Card) {
  if (card.source === 'donationalerts') {
    return card.description || card.title
  }
  return card.title
}

// Полный текст для всплывающей подсказки
function getFullText(card: Card) {
  if (card.source === 'donationalerts') {
    return `${card.donorName}: ${card.description || card.title}`
  }
  return card.description ? `${card.title}\n${card.description}` : card.title
}

// '2026-10-12T13:04:13+00:00' → '16:04' (в часовом поясе пользователя)
function formatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
