import type { ListenerStatus } from '../../api/auth'
import type { CurrentUser } from '../../api/me'
import { useDonationAlertsStatus } from '../../hooks/useDonationAlertsStatus'
import { useIntakeSettings } from '../../hooks/useIntakeSettings'
import { AccountMenu } from '../AccountMenu/AccountMenu'
import { DonationAlertsRow } from '../DonationAlertsRow/DonationAlertsRow'
import { GuestConnectTip } from '../GuestConnectTip/GuestConnectTip'
import styles from './StreamerAccountMenu.module.css'

// Что делает DonationAlerts — коротко: в меню и в подсказке у точки
const listenerLabels: Record<ListenerStatus, string> = {
  not_configured: 'Не настроен',
  not_connected: 'Не подключён',
  connecting: 'Подключаюсь…',
  listening: 'Слушаю донаты',
  error: 'Нет связи',
}

// Пояснение под строкой DonationAlerts. Когда всё работает, пояснять нечего.
const listenerDescriptions: Record<ListenerStatus, string | null> = {
  not_configured:
    'Ключи приложения не вписаны. Впиши DA_CLIENT_ID и DA_CLIENT_SECRET в backend/.env и перезапусти бэкенд.',
  not_connected: 'Донаты не приходят. Подключи DonationAlerts, чтобы они сами появлялись в очереди.',
  connecting: null,
  listening: null,
  error: 'Связь прервалась. Переподключаюсь сам, нажимать ничего не нужно.',
}

// Меню аккаунта на своей доске. К обычному меню добавляется то, что нужно только хозяину:
// индикатор у ника (доходят ли донаты) и в выпадашке статус DonationAlerts и переключатель приёма.
//
// Индикатор у ника, по порядку важности:
//   DonationAlerts не подключён — серая точка, открыт приём или нет (донатам всё равно неоткуда взяться);
//   приём закрыт — жёлтая пауза (это не ошибка, а предупреждение: донаты уходят в историю);
//   иначе точка DonationAlerts: зелёная — слушаю донаты, жёлтая — подключаюсь, красная — нет связи.
type StreamerAccountMenuProps = {
  user: CurrentUser
  onLogout: () => void
}

export function StreamerAccountMenu({ user, onLogout }: StreamerAccountMenuProps) {
  const { status, disconnect } = useDonationAlertsStatus()
  const { settings, changeIntake } = useIntakeSettings()

  // У гостя донатов нет, следить не за чем: обычное меню с «Подключить DonationAlerts».
  // Бэкенд не отвечает — об этом и так скажет доска, тоже показываем обычное меню.
  if (user.isGuest || status === null || settings === null) {
    return (
      <div className={styles.wrapper}>
        <AccountMenu user={user} onLogout={onLogout} />
        {/* Гостю под кнопкой — заметная подсказка подключить DonationAlerts */}
        {user.isGuest && user.canConnectDonationAlerts && <GuestConnectTip />}
      </div>
    )
  }

  const listener = status.listener
  const isIntakeOpen = settings.isOpen
  const description = listenerDescriptions[listener]
  const isDonationAlertsOff = listener === 'not_configured' || listener === 'not_connected'

  const indicator = isDonationAlertsOff || isIntakeOpen ? (
    <span
      className={`${styles.dot} ${styles[listener] ?? ''}`}
      title={`DonationAlerts: ${listenerLabels[listener].toLowerCase()}`}
    />
  ) : (
    <span className={styles.pause} title="Приём закрыт: новые донаты сразу уходят в историю" />
  )

  const streamSection = (
    <div className={styles.section}>
      <DonationAlertsRow
        status={status}
        note={listenerLabels[listener]}
        indicator={<span className={`${styles.dot} ${styles[listener] ?? ''}`} />}
        disconnectQuestion="Отключить DonationAlerts? Новые донаты перестанут попадать на доску."
        onDisconnect={disconnect}
      />
      {description && <p className={styles.description}>{description}</p>}

      {/* Вся строка — переключатель: по клику приём открывается или закрывается */}
      <button
        type="button"
        role="switch"
        aria-checked={isIntakeOpen}
        className={isIntakeOpen ? styles.intakeRow : `${styles.intakeRow} ${styles.closed}`}
        onClick={() => changeIntake({ isOpen: !isIntakeOpen })}
      >
        <span className={styles.track} aria-hidden="true" />
        <span className={styles.rowText}>
          {isIntakeOpen ? 'Приём открыт' : 'Приём закрыт'}
          <span className={styles.rowNote}>
            {isIntakeOpen ? 'Донаты попадают на доску' : 'Донаты сразу уходят в историю'}
          </span>
        </span>
      </button>
    </div>
  )

  return (
    <AccountMenu user={user} onLogout={onLogout} indicator={indicator}>
      {streamSection}
    </AccountMenu>
  )
}
