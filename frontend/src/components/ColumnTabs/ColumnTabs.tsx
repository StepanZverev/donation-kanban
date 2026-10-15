import { useEffect, useRef } from 'react'
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
// Если колонок много или названия длинные, вкладки прокручиваются вбок,
// а слишком длинное название обрезается многоточием (целиком — в подсказке).
export function ColumnTabs(props: ColumnTabsProps) {
  const { columns, getCardCount, activeColumnId, onSelect } = props
  // Кнопка открытой вкладки — чтобы прокрутить к ней, если она за краем
  const activeTabRef = useRef<HTMLButtonElement>(null)

  // Открыли другую колонку — подвинуть вкладки так, чтобы её вкладка была видна целиком
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeColumnId])

  return (
    <div className={styles.tabs} role="tablist">
      {columns.map((column) => (
        <button
          key={column.id}
          type="button"
          role="tab"
          aria-selected={column.id === activeColumnId}
          ref={column.id === activeColumnId ? activeTabRef : undefined}
          title={column.title}
          className={column.id === activeColumnId ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onSelect(column.id)}
          // Если тащат карточку мышью и навели на вкладку — открываем эту колонку,
          // чтобы карточку можно было бросить прямо в неё
          onDragEnter={() => onSelect(column.id)}
        >
          <span className={styles.name}>{column.title}</span>
          <span className={styles.count}>{getCardCount(column.id)}</span>
        </button>
      ))}
    </div>
  )
}
