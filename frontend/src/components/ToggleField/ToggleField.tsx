import { SettingField } from '../SettingField/SettingField'
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
// Строка — это <label>: клик в любом её месте переключает.
export function ToggleField(props: ToggleFieldProps) {
  const { label, description, checked, onChange } = props

  return (
    <SettingField layout="row" element="label" className={styles.field} label={label} description={description}>
      <input
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </SettingField>
  )
}
