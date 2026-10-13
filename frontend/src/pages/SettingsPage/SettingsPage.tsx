import { ColumnsSettings } from '../../components/ColumnsSettings/ColumnsSettings'
import { PriorityLevelsSettings } from '../../components/PriorityLevelsSettings/PriorityLevelsSettings'
import styles from './SettingsPage.module.css'

// Страница «Настройки»: колонки доски и уровни приоритета карточек.
// Каждый раздел сам загружает и сохраняет свои данные.
export function SettingsPage() {
  return (
    <div className={styles.page}>
      <ColumnsSettings />
      <PriorityLevelsSettings />
    </div>
  )
}
