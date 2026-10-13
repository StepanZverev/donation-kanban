import { useAutoMerge } from '../../hooks/useAutoMerge'
import styles from './AutoMergeSettings.module.css'

// Раздел «Объединение карточек» на странице настроек
export function AutoMergeSettings() {
  const { isEnabled, error, setAutoMerge } = useAutoMerge()

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Объединение карточек</h2>
      <p className={styles.hint}>
        Если донатер задонатил ещё раз, а его прошлая карточка ещё на доске, новую карточку можно
        слить в старую: перетащить одну на другую или выбрать «Объединить с прошлым донатом» в меню
        «⋯». Суммы сложатся, текст допишется в конец.
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
