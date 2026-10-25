import type { ReactNode } from 'react'
import styles from './SettingField.module.css'

type SettingFieldProps = {
  label: string
  // Пояснение мелким серым текстом под названием
  description?: ReactNode
  // row — название слева, справа то, что внутри: переключатель, кнопка, поле суммы.
  //   Строки отделены друг от друга линией.
  // column — то, что внутри, стоит под названием: поле со ссылкой, кнопки, список.
  //   Блоки отделены друг от друга только отступом.
  layout: 'row' | 'column'
  // label — клик по названию передаётся полю внутри (переключателю, полю суммы).
  // div — когда внутри кнопка: клик по тексту не должен её нажимать.
  element?: 'div' | 'label'
  // Свой класс для мелких отличий (например, линия снизу у блока column)
  className?: string
  children: ReactNode
}

// Одна настройка: название, пояснение и то, чем она меняется.
// Одинаково выглядит во всех разделах настроек.
export function SettingField(props: SettingFieldProps) {
  const { label, description, layout, element = 'div', className, children } = props
  // Тег берём из пропса: <Element> превратится в <div> или <label>
  const Element = element
  const text = (
    <>
      <span className={styles.label}>{label}</span>
      {description && <span className={styles.description}>{description}</span>}
    </>
  )

  return (
    <Element className={className ? `${styles[layout]} ${className}` : styles[layout]}>
      {/* В строке название и пояснение — одним столбиком слева */}
      {layout === 'row' ? <span className={styles.text}>{text}</span> : text}
      {children}
    </Element>
  )
}
