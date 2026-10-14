import { useIntakeSettings } from '../../hooks/useIntakeSettings'
import styles from './IntakeToggle.module.css'

// Переключатель «Приём открыт / закрыт» в шапке. Это та же настройка, что
// «Принимать заказы» в разделе «Приём донатов», вынесенная под руку:
// например, чтобы закрыть приём в конце стрима.
export function IntakeToggle() {
  const { settings, changeIntake } = useIntakeSettings()

  // Бэкенд не отвечает — об этом и так скажет доска
  if (!settings) {
    return null
  }

  const label = settings.isOpen ? 'Приём открыт' : 'Приём закрыт'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={settings.isOpen}
      className={settings.isOpen ? styles.toggle : `${styles.toggle} ${styles.closed}`}
      title={
        settings.isOpen
          ? 'Донаты попадают на доску. Нажми, чтобы закрыть приём.'
          : 'Донаты сразу уходят в историю. Нажми, чтобы открыть приём.'
      }
      onClick={() => changeIntake({ isOpen: !settings.isOpen })}
    >
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </button>
  )
}
