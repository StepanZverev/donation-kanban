import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { DONOR_NAME_MAX_LENGTH } from '../../defaults'
import { useDonorSuggestions } from '../../hooks/useDonorSuggestions'
import styles from './NickInput.module.css'

type NickInputProps = {
  value: string
  onChange: (value: string) => void
}

// Поле «Ник» с подсказками: под полем список ников с доски и из истории.
// Выбрать — кликом или стрелками и Enter. Esc закрывает список, а не окно.
export function NickInput(props: NickInputProps) {
  const { value, onChange } = props
  const suggestions = useDonorSuggestions(value)
  const [isOpen, setIsOpen] = useState(false)
  // Какая подсказка выбрана стрелками (-1 — никакая)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Если вписан ровно ник из подсказки, список не нужен
  const visibleSuggestions = suggestions.filter((name) => name !== value)
  const showList = isOpen && visibleSuggestions.length > 0

  return (
    <div className={styles.wrapper}>
      <input
        autoComplete="off"
        className={styles.input}
        value={value}
        maxLength={DONOR_NAME_MAX_LENGTH}
        placeholder="Аноним"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={handleChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {showList && (
        <ul className={styles.list} role="listbox">
          {visibleSuggestions.map((name, index) => (
            <li
              key={name}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? `${styles.option} ${styles.active}` : styles.option}
              // mousedown, а не click: click случится после blur, когда список уже закрыт
              onMouseDown={(event) => {
                event.preventDefault()
                choose(name)
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value)
    setIsOpen(true)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((activeIndex + 1) % visibleSuggestions.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(activeIndex <= 0 ? visibleSuggestions.length - 1 : activeIndex - 1)
    }
    // Enter с выбранной подсказкой подставляет ник, а не сохраняет форму
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      choose(visibleSuggestions[activeIndex])
    }
    // Esc закрывает только список; без preventDefault закрылось бы всё окно
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  function choose(name: string) {
    onChange(name)
    setIsOpen(false)
    setActiveIndex(-1)
  }
}
