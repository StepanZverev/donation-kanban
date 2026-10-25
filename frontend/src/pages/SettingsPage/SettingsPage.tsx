import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { SETTINGS_SECTIONS } from './settingsSections'
import styles from './SettingsPage.module.css'

// Страница «Настройки»: меню разделов слева, выбранный раздел справа.
// Каждый раздел сам загружает и сохраняет свои данные.
export function SettingsPage() {
  const menuRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // На телефоне меню — одна строка с прокруткой вбок. Открытый раздел может оказаться
  // за краем экрана, поэтому прокручиваем строку так, чтобы его было видно.
  useEffect(() => {
    const activeLink = menuRef.current?.querySelector('[aria-current="page"]')
    activeLink?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <div className={styles.page}>
      <nav ref={menuRef} className={styles.menu} aria-label="Разделы настроек">
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

