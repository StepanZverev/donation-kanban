import { AutoMergeSettings } from '../AutoMergeSettings/AutoMergeSettings'
import { IntakeSettingsFields } from '../IntakeSettingsFields/IntakeSettingsFields'
import { ResetBoardSettings } from '../ResetBoardSettings/ResetBoardSettings'
import { SoundSettings } from '../SoundSettings/SoundSettings'
import styles from './DonationsSettings.module.css'

// Раздел «Приём донатов» на странице настроек: какие донаты становятся карточками
// что делать с повторными донатами, звук нового доната и сброс доски в конце стрима.
export function DonationsSettings() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Приём донатов</h2>
      <p className={styles.hint}>Что происходит с новым донатом, когда он приходит.</p>
      <IntakeSettingsFields />
      <AutoMergeSettings />
      <SoundSettings />
      <ResetBoardSettings />
    </section>
  )
}
