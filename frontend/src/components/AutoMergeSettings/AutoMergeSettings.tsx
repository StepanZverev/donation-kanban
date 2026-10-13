import { useAutoMerge } from '../../hooks/useAutoMerge'
import styles from './AutoMergeSettings.module.css'

// Раздел «Объединение карточек» на странице настроек
export function AutoMergeSettings() {
  const { isEnabled, error, setAutoMerge } = useAutoMerge()

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Объединение карточек</h2>
      <p className={styles.hint}>
        Карточки одного донатера можно слить в одну: перетащить одну на другую или выбрать
        «Объединить все донаты в эту карточку» в меню «⋯». Суммы сложатся, тексты допишутся в конец.
        «Разъединить» в том же меню вернёт карточки обратно.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setAutoMerge(event.target.checked)}
        />
        Объединять донаты одного донатера автоматически
      </label>
    </section>
  )
}
