import { useState, type KeyboardEvent } from 'react'
import { COLUMN_TITLE_MAX_LENGTH, MAX_WORK_COLUMNS } from '../../defaults'
import { useColumnSettings } from '../../hooks/useColumnSettings'
import type { BoardColumn } from '../../types/card'
import { ColumnDialog } from '../ColumnDialog/ColumnDialog'
import { ColumnsBoardView } from '../ColumnsBoardView/ColumnsBoardView'
import { TrashIcon } from '../Icons/Icons'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './ColumnsSettings.module.css'

// Какое окно сейчас открыто: создание колонки, переименование или никакое
type DialogState = { mode: 'create' } | { mode: 'edit'; column: BoardColumn } | null

// Раздел «Колонки доски» на странице настроек.
// На широком экране колонки стоят в ряд, как на доске (ColumnsBoardView),
// а на телефоне — списком сверху вниз (сверху вниз = на доске слева направо).
export function ColumnsSettings() {
  const { columns, workColumns, error, addColumn, renameColumn, removeColumn, moveColumn } =
    useColumnSettings()
  const [dialog, setDialog] = useState<DialogState>(null)

  const incomingColumn = columns.find((column) => column.kind === 'incoming')
  const doneColumn = columns.find((column) => column.kind === 'done')
  const canAdd = workColumns.length < MAX_WORK_COLUMNS

  return (
    <SettingsSection
      title="Колонки доски"
      hint={
        <>
          «{incomingColumn?.title ?? 'Очередь'}» и «{doneColumn?.title ?? 'Выполнено'}» есть всегда.
          Между ними можно поставить до {MAX_WORK_COLUMNS} колонок, а можно ни одной. Если удалить
          колонку, её карточки вернутся в «{incomingColumn?.title ?? 'Очередь'}».
        </>
      }
      error={error}
      isWide
    >
      <div className={styles.boardView}>
        <ColumnsBoardView
          incomingColumn={incomingColumn}
          workColumns={workColumns}
          doneColumn={doneColumn}
          canAdd={canAdd}
          onAddClick={() => setDialog({ mode: 'create' })}
          onEditClick={(column) => setDialog({ mode: 'edit', column })}
          onMove={moveColumn}
          onRemove={handleRemove}
        />
      </div>

      {/* Список для узкого экрана: какой из двух видов показать, решает CSS */}
      <div className={styles.listView}>
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
              onRename={renameColumn}
              onMove={moveColumn}
              onRemove={handleRemove}
            />
          ))}

          {doneColumn && <FixedColumnRow column={doneColumn} note="всегда последняя" />}
        </ol>

        {/* Новая колонка — через то же окно, что и на широком экране */}
        <button
          type="button"
          className={styles.addButton}
          disabled={!canAdd}
          onClick={() => setDialog({ mode: 'create' })}
        >
          {canAdd ? '+ Новая колонка' : `Уже ${MAX_WORK_COLUMNS} колонки, больше нельзя`}
        </button>
      </div>

      {dialog && (
        <ColumnDialog
          heading={dialog.mode === 'create' ? 'Новая колонка' : 'Колонка'}
          initialTitle={dialog.mode === 'edit' ? dialog.column.title : ''}
          submitLabel={dialog.mode === 'create' ? 'Добавить' : 'Сохранить'}
          onSubmit={handleDialogSubmit}
          onClose={() => setDialog(null)}
        />
      )}
    </SettingsSection>
  )

  function handleDialogSubmit(title: string) {
    if (dialog?.mode === 'create') {
      addColumn(title)
    }
    if (dialog?.mode === 'edit' && title !== dialog.column.title) {
      renameColumn(dialog.column.id, title)
    }
    setDialog(null)
  }

  function handleRemove(column: BoardColumn) {
    const question = `Удалить колонку «${column.title}»? Её карточки вернутся в «${incomingColumn?.title ?? 'Очередь'}».`
    if (window.confirm(question)) {
      removeColumn(column.id)
    }
  }
}

type FixedColumnRowProps = {
  column: BoardColumn
  note: string
}

// «Очередь» и «Выполнено»: просто строка с названием, менять нечего
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
  onRename: (id: number, title: string) => void
  onMove: (id: number, step: -1 | 1) => void
  onRemove: (column: BoardColumn) => void
}

// Промежуточная колонка: название можно править прямо в поле,
// сохраняется, когда уходишь из поля или жмёшь Enter.
function WorkColumnRow(props: WorkColumnRowProps) {
  const { column, isFirst, isLast, onRename, onMove, onRemove } = props
  const [title, setTitle] = useState(column.title)

  return (
    <li className={styles.row}>
      <input
        autoComplete="off"
        className={styles.input}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={COLUMN_TITLE_MAX_LENGTH}
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
          title="Удалить колонку"
          aria-label="Удалить колонку"
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
