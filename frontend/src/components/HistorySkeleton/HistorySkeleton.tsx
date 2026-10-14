import { Skeleton } from '../Skeleton/Skeleton'
import styles from './HistorySkeleton.module.css'

// Сколько строк истории рисовать, пока она грузится
const ROW_COUNT = 6

// Заглушка истории: заголовок дня и серые строки на месте настоящих
export function HistorySkeleton() {
  return (
    <div className={styles.list} aria-busy="true" aria-label="Загружаю историю">
      <Skeleton width={180} height={16} />
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <div key={index} className={styles.row}>
          <Skeleton width={40} height={12} />
          <Skeleton width={80} height={18} />
          <Skeleton width={`${50 + ((index * 17) % 40)}%`} />
          <Skeleton width={60} />
        </div>
      ))}
    </div>
  )
}
