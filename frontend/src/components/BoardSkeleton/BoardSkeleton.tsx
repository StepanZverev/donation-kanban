import { Skeleton } from '../Skeleton/Skeleton'
import styles from './BoardSkeleton.module.css'

// Сколько колонок и карточек в них рисовать, пока доска грузится
const CARDS_IN_COLUMNS = [3, 1, 2]

// Заглушка доски: серые колонки с серыми карточками на месте настоящих
export function BoardSkeleton() {
  return (
    <div className={styles.board} aria-busy="true" aria-label="Загружаю доску">
      {CARDS_IN_COLUMNS.map((cardCount, columnIndex) => (
        <div key={columnIndex} className={styles.column}>
          <Skeleton width="40%" height={16} />
          <Skeleton width="25%" height={10} />

          {Array.from({ length: cardCount }, (_, cardIndex) => (
            <div key={cardIndex} className={styles.card}>
              <Skeleton width="45%" />
              <Skeleton width="90%" height={12} />
              <Skeleton width="60%" height={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
