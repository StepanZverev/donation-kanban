import { AutoMergeSettings } from '../AutoMergeSettings/AutoMergeSettings'
import { IntakeSettingsFields } from '../IntakeSettingsFields/IntakeSettingsFields'
import styles from './DonationsSettings.module.css'

// Раздел «Приём донатов» на странице настроек: какие донаты становятся карточками
// и что делать с повторными донатами. Позже сюда добавится звук нового доната.
export function DonationsSettings() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Приём донатов</h2>
      <p className={styles.hint}>Что происходит с новым донатом, когда он приходит.</p>
      <IntakeSettingsFields />
      <AutoMergeSettings />
    </section>
  )
}
