import { NavLink, Outlet } from 'react-router'
import { SETTINGS_SECTIONS } from './settingsSections'
import styles from './SettingsPage.module.css'

// Страница «Настройки»: меню разделов слева, выбранный раздел справа.
// Каждый раздел сам загружает и сохраняет свои данные.
export function SettingsPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.menu} aria-label="Разделы настроек">
        {SETTINGS_SECTIONS.map((section) => (
          <NavLink key={section.path} to={section.path} className={getLinkClassName}>
            {section.title}
          </NavLink>
        ))}
      </nav>

      {/* Сюда React Router подставит раздел, который совпал с адресом */}
      <div className={styles.panel}>
        <Outlet />
      </div>
    </div>
  )

  function getLinkClassName({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.link} ${styles.active}` : styles.link
  }
}

