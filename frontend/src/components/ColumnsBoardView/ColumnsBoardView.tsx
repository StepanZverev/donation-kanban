import type { BoardColumn } from '../../types/card'
import { PencilIcon, PlusIcon, TrashIcon } from '../Icons/Icons'
import styles from './ColumnsBoardView.module.css'

type ColumnsBoardViewProps = {
  incomingColumn: BoardColumn | undefined
  workColumns: BoardColumn[]
  doneColumn: BoardColumn | undefined
  canAdd: boolean
  onAddClick: () => void
  onEditClick: (column: BoardColumn) => void
  onMove: (id: number, step: -1 | 1) => void
  onRemove: (column: BoardColumn) => void
}

// Колонки доски в настройках так, как они стоят на доске: слева направо.
// Крайние закреплены, промежуточные можно переименовать, сдвинуть и удалить (хоть все).
// Пунктирная плитка «+» в конце добавляет новую колонку.
export function ColumnsBoardView(props: ColumnsBoardViewProps) {
  const {
    incomingColumn,
    workColumns,
    doneColumn,
    canAdd,
    onAddClick,
    onEditClick,
    onMove,
    onRemove,
  } = props

  return (
    <div className={styles.board}>
      {incomingColumn && <FixedColumn column={incomingColumn} note="Всегда первая" />}

      {workColumns.map((column, index) => (
        <div key={column.id} className={styles.column}>
          <span className={styles.title}>{column.title}</span>

          <CardStubs />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              title="Левее на доске"
              aria-label="Левее на доске"
              disabled={index === 0}
              onClick={() => onMove(column.id, -1)}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.iconButton}
              title="Правее на доске"
              aria-label="Правее на доске"
              disabled={index === workColumns.length - 1}
              onClick={() => onMove(column.id, 1)}
            >
              ›
            </button>
            {/* Карандаш открывает окно с настройками колонки */}
            <button
              type="button"
              className={`${styles.iconButton} ${styles.editButton}`}
              title="Изменить колонку"
              aria-label="Изменить колонку"
              onClick={() => onEditClick(column)}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.dangerButton}`}
              title="Удалить колонку"
              aria-label="Удалить колонку"
              onClick={() => onRemove(column)}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      ))}

      {canAdd && (
        <button type="button" className={styles.addColumn} onClick={onAddClick}>
          <PlusIcon />
          Новая колонка
        </button>
      )}

      {doneColumn && <FixedColumn column={doneColumn} note="Всегда последняя" />}
    </div>
  )
}

type FixedColumnProps = {
  column: BoardColumn
  note: string
}

// «Очередь» и «Выполнено»: менять нечего, только название и пометка
function FixedColumn(props: FixedColumnProps) {
  const { column, note } = props

  return (
    <div className={`${styles.column} ${styles.fixedColumn}`}>
      <span className={styles.fixedTitle}>{column.title}</span>
      <CardStubs />
      <span className={styles.note}>{note}</span>
    </div>
  )
}

// Бледные полоски-«карточки», чтобы плитка была похожа на колонку доски
function CardStubs() {
  return (
    <div className={styles.stubs} aria-hidden="true">
      <span className={styles.stub} />
      <span className={styles.stub} />
      <span className={styles.stub} />
    </div>
  )
}
