import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { BoardColumn } from '../../types/card'
import styles from './CardMenu.module.css'

type CardMenuProps = {
  // Колонки, в которые карточку можно перенести (все, кроме текущей)
  moveTargets: BoardColumn[]
  onEdit: () => void
  onMove: (columnId: number) => void
  onDelete: () => void
  // «Отклонить…»: откроется окно с причиной
  onReject: () => void
  // «Объединить все донаты в эту карточку» и «Разъединить». Не передали — пункта в меню нет.
  onMergeAll?: () => void
  onUnmerge?: () => void
}

// Если под кнопкой меньше места, чем столько пикселей, меню открывается вверх
const DROPDOWN_HEIGHT_GUESS = 240

// Маленькое меню «⋯» на карточке: редкие действия, которые нужны больше модератору.
export function CardMenu(props: CardMenuProps) {
  const { moveTargets, onEdit, onMove, onDelete, onReject, onMergeAll, onUnmerge } = props
  // Где показать открытое меню (координаты на экране). null — меню закрыто.
  const [dropdownPosition, setDropdownPosition] = useState<CSSProperties | null>(null)
  const isOpen = dropdownPosition !== null
  const toggleRef = useRef<HTMLButtonElement>(null)

  return (
    // onBlur на обёртке: фокус ушёл куда-то за пределы меню (кликнули мимо) — закрываем.
    // onKeyDown: Esc закрывает меню и возвращает фокус на кнопку «⋯»
    <div className={styles.menu} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        title="Ещё действия"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        ⋯
      </button>

      {isOpen && (
        <div className={styles.dropdown} style={dropdownPosition}>
          <button type="button" onClick={handleEdit}>
            Изменить
          </button>

          {onMergeAll && (
            <button
              type="button"
              title="Все карточки этого донатера сольются в эту: суммы сложатся, тексты допишутся в конец"
              onClick={handleMergeAll}
            >
              Объединить все донаты в эту карточку
            </button>
          )}

          {onUnmerge && (
            <button
              type="button"
              title="Слитые донаты вернутся на доску отдельными карточками"
              onClick={handleUnmerge}
            >
              Разъединить
            </button>
          )}

          <p className={styles.groupTitle}>Переместить в</p>
          {moveTargets.map((column) => (
            <button key={column.id} type="button" onClick={() => handleMove(column.id)}>
              {column.title}
            </button>
          ))}

          <button
            type="button"
            className={styles.danger}
            title="Не буду выполнять: карточка уйдёт в историю с пометкой «Отклонено» и причиной"
            onClick={handleReject}
          >
            Отклонить…
          </button>
          <button type="button" className={styles.danger} onClick={handleDelete}>
            Удалить
          </button>
        </div>
      )}
    </div>
  )

  // Меню рисуем с position: fixed по координатам кнопки. Иначе колонка с прокруткой
  // обрезала бы его по своему краю.
  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    if (isOpen) {
      setDropdownPosition(null)
      return
    }
    const button = event.currentTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - button.bottom
    if (spaceBelow > DROPDOWN_HEIGHT_GUESS) {
      setDropdownPosition({ top: button.bottom + 4, left: button.left })
    } else {
      setDropdownPosition({ bottom: window.innerHeight - button.top + 4, left: button.left })
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // relatedTarget — элемент, куда ушёл фокус. Если он внутри меню, меню не закрываем.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDropdownPosition(null)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && isOpen) {
      setDropdownPosition(null)
      toggleRef.current?.focus()
    }
  }

  function handleEdit() {
    setDropdownPosition(null)
    onEdit()
  }

  function handleMergeAll() {
    setDropdownPosition(null)
    onMergeAll?.()
  }

  function handleUnmerge() {
    setDropdownPosition(null)
    onUnmerge?.()
  }

  function handleMove(columnId: number) {
    setDropdownPosition(null)
    onMove(columnId)
  }

  function handleReject() {
    setDropdownPosition(null)
    onReject()
  }

  function handleDelete() {
    setDropdownPosition(null)
    onDelete()
  }
}
