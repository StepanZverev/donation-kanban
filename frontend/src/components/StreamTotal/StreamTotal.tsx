import { STREAMER_CURRENCY } from '../../defaults'
import { useStreamTotal } from '../../hooks/useStreamTotal'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import styles from './StreamTotal.module.css'

// Сумма за стрим в шапке: сумма крупно, под ней число донатов.
// Копится с последнего сброса, «Очистить» у колонок её не трогает.
// Сбросить можно в настройках: «Приём донатов» → «Сбросить доску».
export function StreamTotal() {
  const { streamTotal } = useStreamTotal()

  if (!streamTotal) {
    return null
  }

  const { total, donationCount } = streamTotal

  return (
    <div className={styles.total} title="Сумма за стрим">
      <span className={styles.amount}>{formatMoney(total, STREAMER_CURRENCY)}</span>
      <span className={styles.count}>
        {donationCount} {pluralize(donationCount, ['донат', 'доната', 'донатов'])}
      </span>
    </div>
  )
}
