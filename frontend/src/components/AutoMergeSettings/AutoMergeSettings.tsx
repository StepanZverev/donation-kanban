import { useAutoMerge } from '../../hooks/useAutoMerge'
import { ToggleField } from '../ToggleField/ToggleField'
import styles from './AutoMergeSettings.module.css'

// Переключатель «Объединять автоматически» в разделе «Приём донатов» на странице настроек
export function AutoMergeSettings() {
  const { isEnabled, error, setAutoMerge } = useAutoMerge()

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <ToggleField
        label="Объединять донаты одного донатера автоматически"
        description="Новый донат сам сливается с карточкой того же донатера, если она уже есть в очереди или в работе. Суммы сложатся, текст допишется в конец. Вручную карточки можно слить, перетащив одну на другую."
        checked={isEnabled}
        onChange={setAutoMerge}
      />
    </>
  )
}
