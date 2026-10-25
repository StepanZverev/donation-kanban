import { useThemeMode } from '../../hooks/useThemeMode'
import type { ThemeMode } from '../../utils/theme'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './ThemeSettings.module.css'

// Варианты в том порядке, в каком они стоят на экране
const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Как в системе' },
  { mode: 'light', label: 'Светлая' },
  { mode: 'dark', label: 'Тёмная' },
]

// Раздел «Внешний вид» на странице настроек: три кнопки-переключателя темы
export function ThemeSettings() {
  const { mode, changeMode } = useThemeMode()

  return (
    <SettingsSection title="Внешний вид" hint="Тема запоминается в этом браузере.">
      <div className={styles.options} role="radiogroup" aria-label="Тема">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={mode === option.mode}
            className={mode === option.mode ? `${styles.option} ${styles.selected}` : styles.option}
            onClick={() => changeMode(option.mode)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingsSection>
  )
}
