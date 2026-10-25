import type { ReactNode } from 'react'
import styles from './SettingsSection.module.css'

type SettingsSectionProps = {
  title: string
  // Пояснение под заголовком: что настраивается в разделе. Можно без него.
  hint?: ReactNode
  // Ошибка загрузки или сохранения — красной плашкой под пояснением
  error?: string | null
  // Широкий раздел занимает всё место справа от меню («Колонки»: колонки стоят в ряд, как на доске).
  // Остальные разделы — узкой колонкой: длинные строки неудобно читать.
  isWide?: boolean
  children: ReactNode
}

// Раздел страницы настроек: заголовок, пояснение, ошибка и сами настройки.
// Так все разделы выглядят одинаково.
export function SettingsSection(props: SettingsSectionProps) {
  const { title, hint, error, isWide = false, children } = props

  return (
    <section className={isWide ? styles.section : `${styles.section} ${styles.narrow}`}>
      <h2 className={styles.title}>{title}</h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {error && <p className="error-message">{error}</p>}
      {children}
    </section>
  )
}
