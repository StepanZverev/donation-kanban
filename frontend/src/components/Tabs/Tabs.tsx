import styles from './Tabs.module.css'

type Tab<T extends string> = {
  id: T
  label: string
}

type TabsProps<T extends string> = {
  tabs: Tab<T>[]
  activeTab: T
  onChange: (tab: T) => void
}

export function Tabs<T extends string>({ tabs, activeTab, onChange }: TabsProps<T>) {
  return (
    <nav className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? styles.active : styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
