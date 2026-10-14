import type { BoardColumn } from '../../types/card'
import styles from './ColumnTabs.module.css'

type ColumnTabsProps = {
  columns: BoardColumn[]
  // Сколько карточек в колонке — число рядом с названием
  getCardCount: (columnId: number) => number
  activeColumnId: number
  onSelect: (columnId: number) => void
}

// Вкладки колонок над доской. Видны только на узком экране, где колонки
// не помещаются рядом: там показываем одну колонку, а между ними переключаемся здесь.
export function ColumnTabs(props: ColumnTabsProps) {
  const { columns, getCardCount, activeColumnId, onSelect } = props

  return (
    <div className={styles.tabs} role="tablist">
      {columns.map((column) => (
        <button
          key={column.id}
          type="button"
          role="tab"
          aria-selected={column.id === activeColumnId}
          className={column.id === activeColumnId ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onSelect(column.id)}
          // Если тащат карточку мышью и навели на вкладку — открываем эту колонку,
          // чтобы карточку можно было бросить прямо в неё
          onDragEnter={() => onSelect(column.id)}
        >
          {column.title}
          <span className={styles.count}>{getCardCount(column.id)}</span>
        </button>
      ))}
    </div>
  )
}
