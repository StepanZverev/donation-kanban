import { AutoMergeSettings } from '../../components/AutoMergeSettings/AutoMergeSettings'
import { ColumnsSettings } from '../../components/ColumnsSettings/ColumnsSettings'
import { PriorityLevelsSettings } from '../../components/PriorityLevelsSettings/PriorityLevelsSettings'
import styles from './SettingsPage.module.css'

// Страница «Настройки»: колонки доски, уровни приоритета и объединение карточек.
// Каждый раздел сам загружает и сохраняет свои данные.
export function SettingsPage() {
  return (
    <div className={styles.page}>
      <ColumnsSettings />
      <PriorityLevelsSettings />
      <AutoMergeSettings />
    </div>
  )
}
