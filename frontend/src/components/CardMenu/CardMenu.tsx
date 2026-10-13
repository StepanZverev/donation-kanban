import { useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import type { BoardColumn } from '../../types/card'
import styles from './CardMenu.module.css'

type CardMenuProps = {
  // Колонки, в которые карточку можно перенести (все, кроме текущей)
  moveTargets: BoardColumn[]
  onEdit: () => void
  onMove: (columnId: number) => void
  onDelete: () => void
}

// Если под кнопкой меньше места, чем столько пикселей, меню открывается вверх
const DROPDOWN_HEIGHT_GUESS = 240

// Маленькое меню «⋯» на карточке: редкие действия, которые нужны больше модератору.
export function CardMenu(props: CardMenuProps) {
  const { moveTargets, onEdit, onMove, onDelete } = props
  // Где показать открытое меню (координаты на экране). null — меню закрыто.
  const [dropdownPosition, setDropdownPosition] = useState<CSSProperties | null>(null)
  const isOpen = dropdownPosition !== null

  return (
    // onBlur на обёртке: фокус ушёл куда-то за пределы меню (кликнули мимо) — закрываем.
    <div className={styles.menu} onBlur={handleBlur}>
      <button
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

          <p className={styles.groupTitle}>Переместить в</p>
          {moveTargets.map((column) => (
            <button key={column.id} type="button" onClick={() => handleMove(column.id)}>
              {column.title}
            </button>
          ))}

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

  function handleEdit() {
    setDropdownPosition(null)
    onEdit()
  }

  function handleMove(columnId: number) {
    setDropdownPosition(null)
    onMove(columnId)
  }

  function handleDelete() {
    setDropdownPosition(null)
    onDelete()
  }
}
