import { useThemeMode } from '../../hooks/useThemeMode'
import type { ThemeMode } from '../../utils/theme'
import { SettingField } from '../SettingField/SettingField'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './ThemeSettings.module.css'

// Варианты в том порядке, в каком они стоят на экране
const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Как в системе' },
  { mode: 'light', label: 'Светлая' },
  { mode: 'dark', label: 'Тёмная' },
]

// Раздел «Внешний вид» на странице настроек: выбор темы картинками
export function ThemeSettings() {
  const { mode, changeMode } = useThemeMode()

  return (
    <SettingsSection title="Внешний вид">
      <SettingField label="Тема" layout="column">
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
              <ThemePreview mode={option.mode} />
              {option.label}
            </button>
          ))}
        </div>
      </SettingField>
    </SettingsSection>
  )
}

// Маленькая картинка доски в этой теме. «Как в системе» — слева светлая, справа тёмная.
function ThemePreview(props: { mode: ThemeMode }) {
  const { mode } = props

  if (mode === 'system') {
    return (
      <span className={styles.preview} aria-hidden="true">
        <MiniBoard theme="light" />
        <span className={styles.rightHalf}>
          <MiniBoard theme="dark" />
        </span>
      </span>
    )
  }

  return (
    <span className={styles.preview} aria-hidden="true">
      <MiniBoard theme={mode} />
    </span>
  )
}

// Шапка и три колонки с карточками — цветами светлой или тёмной темы
function MiniBoard(props: { theme: 'light' | 'dark' }) {
  return (
    <span className={`${styles.board} ${props.theme === 'dark' ? styles.dark : styles.light}`}>
      <span className={styles.header} />
      <span className={styles.columns}>
        {[3, 2, 1].map((cardCount, index) => (
          <span key={index} className={styles.column}>
            {Array.from({ length: cardCount }, (_, cardIndex) => (
              <span key={cardIndex} className={styles.card} />
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}
