import { useStreamTotal } from '../../hooks/useStreamTotal'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import styles from './StreamTotal.module.css'

// Сумма за стрим в шапке: сумма крупно, под ней число донатов.
// Копится с последнего сброса, «Очистить» у колонок её не трогает.
// Клик по сумме — «Сбросить доску» (с подтверждением).
export function StreamTotal() {
  const { streamTotal, resetBoard } = useStreamTotal()

  if (!streamTotal) {
    return null
  }

  const { total, donationCount } = streamTotal

  return (
    <button
      type="button"
      className={styles.total}
      title="Сумма за стрим. Нажми, чтобы сбросить доску"
      onClick={handleClick}
    >
      <span className={styles.amount}>{formatMoney(total, 'RUB')}</span>
      <span className={styles.count}>
        {donationCount} {pluralize(donationCount, ['донат', 'доната', 'донатов'])}
      </span>
    </button>
  )

  function handleClick() {
    const cardCount = streamTotal?.boardCardCount ?? 0
    const question =
      cardCount > 0
        ? `Сбросить доску? Сумма обнулится, а ${pluralize(cardCount, ['вся', 'все', 'все'])} ${cardCount} ` +
          `${pluralize(cardCount, ['карточка уйдёт', 'карточки уйдут', 'карточек уйдут'])} с доски в историю.`
        : 'Сбросить сумму за стрим? Она начнёт копиться заново.'
    if (window.confirm(question)) {
      resetBoard()
    }
  }
}
