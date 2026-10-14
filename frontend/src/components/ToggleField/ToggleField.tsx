import styles from './ToggleField.module.css'

type ToggleFieldProps = {
  label: string
  // Пояснение мелким текстом под названием
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

// Строка настройки: название и пояснение слева, переключатель справа.
// Внутри обычная галочка (checkbox), просто нарисованная как переключатель.
export function ToggleField(props: ToggleFieldProps) {
  const { label, description, checked, onChange } = props

  return (
    <label className={styles.field}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{description}</span>
      </span>

      <input
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
