import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_WORK_COLUMNS, MIN_WORK_COLUMNS, useColumnSettings } from '../../hooks/useColumnSettings'
import type { BoardColumn } from '../../types/card'
import { TrashIcon } from '../Icons/Icons'
import styles from './ColumnsSettings.module.css'

// Раздел «Колонки доски» на странице настроек.
// Список колонок сверху вниз = на доске слева направо.
export function ColumnsSettings() {
  const { columns, workColumns, error, addColumn, renameColumn, removeColumn, moveColumn } =
    useColumnSettings()
  // Название новой колонки в поле внизу списка
  const [newTitle, setNewTitle] = useState('')

  const incomingColumn = columns.find((column) => column.kind === 'incoming')
  const doneColumn = columns.find((column) => column.kind === 'done')
  const canAdd = workColumns.length < MAX_WORK_COLUMNS
  const canRemove = workColumns.length > MIN_WORK_COLUMNS

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Колонки доски</h2>
      <p className={styles.hint}>
        «{incomingColumn?.title ?? 'Куча'}» и «{doneColumn?.title ?? 'Выполнено'}» есть всегда.
        Между ними от {MIN_WORK_COLUMNS} до {MAX_WORK_COLUMNS} колонок. Если удалить колонку,
        её карточки вернутся в первую колонку.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <ol className={styles.list}>
        {incomingColumn && <FixedColumnRow column={incomingColumn} note="всегда первая" />}

        {workColumns.map((column, index) => (
          // В key есть название: если колонку переименуют в другой вкладке,
          // строка создастся заново и поле покажет новое название
          <WorkColumnRow
            key={`${column.id}-${column.title}`}
            column={column}
            isFirst={index === 0}
            isLast={index === workColumns.length - 1}
            canRemove={canRemove}
            onRename={renameColumn}
            onMove={moveColumn}
            onRemove={handleRemove}
          />
        ))}

        {doneColumn && <FixedColumnRow column={doneColumn} note="всегда последняя" />}
      </ol>

      <form className={styles.addForm} onSubmit={handleAddSubmit}>
        <input
          className={styles.input}
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder={canAdd ? 'Название новой колонки' : `Уже ${MAX_WORK_COLUMNS} колонки, больше нельзя`}
          maxLength={40}
          disabled={!canAdd}
        />
        <button type="submit" disabled={!canAdd || newTitle.trim() === ''}>
          + Добавить
        </button>
      </form>
    </section>
  )

  function handleAddSubmit(event: FormEvent) {
    // Без preventDefault браузер перезагрузил бы страницу, отправляя форму
    event.preventDefault()
    addColumn(newTitle.trim())
    setNewTitle('')
  }

  function handleRemove(column: BoardColumn) {
    const question = `Удалить колонку «${column.title}»? Её карточки вернутся в первую колонку.`
    if (window.confirm(question)) {
      removeColumn(column.id)
    }
  }
}

type FixedColumnRowProps = {
  column: BoardColumn
  note: string
}

// «Куча» и «Выполнено»: просто строка с названием, менять нечего
function FixedColumnRow(props: FixedColumnRowProps) {
  const { column, note } = props

  return (
    <li className={`${styles.row} ${styles.fixedRow}`}>
      <span className={styles.fixedTitle}>{column.title}</span>
      <span className={styles.note}>{note}</span>
    </li>
  )
}

type WorkColumnRowProps = {
  column: BoardColumn
  isFirst: boolean
  isLast: boolean
  canRemove: boolean
  onRename: (id: number, title: string) => void
  onMove: (id: number, step: -1 | 1) => void
  onRemove: (column: BoardColumn) => void
}

// Промежуточная колонка: название можно править прямо в поле,
// сохраняется, когда уходишь из поля или жмёшь Enter.
function WorkColumnRow(props: WorkColumnRowProps) {
  const { column, isFirst, isLast, canRemove, onRename, onMove, onRemove } = props
  const [title, setTitle] = useState(column.title)

  return (
    <li className={styles.row}>
      <input
        className={styles.input}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={40}
        aria-label="Название колонки"
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          title="Левее на доске"
          aria-label="Левее на доске"
          disabled={isFirst}
          onClick={() => onMove(column.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.iconButton}
          title="Правее на доске"
          aria-label="Правее на доске"
          disabled={isLast}
          onClick={() => onMove(column.id, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.dangerButton}`}
          title={canRemove ? 'Удалить колонку' : 'Нужна хотя бы одна колонка'}
          aria-label="Удалить колонку"
          disabled={!canRemove}
          onClick={() => onRemove(column)}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  )

  // Ушли из поля — сохраняем. Пустое название не сохраняем, а возвращаем старое.
  function handleBlur() {
    const trimmedTitle = title.trim()
    if (trimmedTitle === '') {
      setTitle(column.title)
    } else if (trimmedTitle !== column.title) {
      onRename(column.id, trimmedTitle)
    }
  }

  // Enter — сохранить (уводим фокус, дальше сработает handleBlur), Escape — отменить правку
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setTitle(column.title)
    }
  }
}
