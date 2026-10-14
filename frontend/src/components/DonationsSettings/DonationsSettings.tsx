import { AutoMergeSettings } from '../AutoMergeSettings/AutoMergeSettings'
import styles from './DonationsSettings.module.css'

// Раздел «Приём донатов» на странице настроек. Пока в нём только автообъединение,
// позже сюда добавятся закрытие приёма, минимальная сумма, анонимные донаты и звук.
export function DonationsSettings() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Приём донатов</h2>
      <p className={styles.hint}>Что происходит с новым донатом, когда он приходит.</p>
      <AutoMergeSettings />
    </section>
  )
}
