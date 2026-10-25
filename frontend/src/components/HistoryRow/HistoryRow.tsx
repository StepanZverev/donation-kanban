import type { Card } from '../../types/card'
import { getCardText, getDonorName } from '../../utils/donor'
import { formatMoney } from '../../utils/money'
import { RestoreIcon, SwordIcon, TrashIcon } from '../Icons/Icons'
import styles from './HistoryRow.module.css'

const archiveReasonLabels = {
  done: 'Выполнено',
  rejected: 'Отклонено',
  deleted: 'Удалено',
  merged: 'Объединено',
}

type HistoryRowProps = {
  card: Card
  // Отсеянный донат пришёл, пока история была закрыта: строка мигнёт подсветкой
  isNew: boolean
  // Удалить навсегда может только стример: у модератора кнопки нет
  canDeleteForever: boolean
  onRestore: (card: Card) => void
  onDeleteForever: (card: Card) => void
}

// Строка истории: время, пометка, ник и текст, сумма и кнопки «Вернуть на доску» и «Удалить навсегда»
export function HistoryRow(props: HistoryRowProps) {
  const { card, isNew, canDeleteForever, onRestore, onDeleteForever } = props

  return (
    <li className={isNew ? `${styles.row} ${styles.fresh}` : styles.row}>
      <span className={styles.time}>{card.archivedAt && formatTime(card.archivedAt)}</span>

      {card.archiveReason && (
        <span className={`${styles.badge} ${styles[card.archiveReason]}`}>
          {archiveReasonLabels[card.archiveReason]}
        </span>
      )}

      {/* Длинный текст обрезается многоточием, целиком — во всплывающей подсказке.
          Справа — метка модератора, если карточку убрал он */}
      <span className={styles.what}>
        <span className={styles.text} title={getFullText(card)}>
          <b className={styles.who}>{getDonorName(card)}</b>
          {' · '}
          {getCardText(card)}
        </span>
        {card.archivedBy && (
          <span
            className={styles.moderator}
            title={`${archiveReasonLabels[card.archiveReason ?? 'deleted']} модератором ${card.archivedBy}`}
          >
            <SwordIcon />
            {card.archivedBy}
          </span>
        )}
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
          onClick={() => onRestore(card)}
        >
          <RestoreIcon />
        </button>
        {canDeleteForever && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.dangerButton}`}
            title="Удалить навсегда"
            aria-label="Удалить навсегда"
            onClick={() => onDeleteForever(card)}
          >
            <TrashIcon />
          </button>
        )}
      </span>

      {/* Причина отказа — отдельной строкой под текстом */}
      {card.archiveReason === 'rejected' && card.archiveNote && (
        <span className={styles.note}>Причина: {card.archiveNote}</span>
      )}
    </li>
  )
}

// Полный текст для всплывающей подсказки
function getFullText(card: Card) {
  return `${getDonorName(card)}: ${getCardText(card)}`
}

// '2026-10-12T13:04:13+00:00' → '16:04' (в часовом поясе пользователя)
function formatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
