import type { PublicBoard } from '../../api/viewer'
import { useTimeAgo } from '../../hooks/useTimeAgo'
import { PlusCircleIcon } from '../Icons/Icons'
import styles from './ViewerHeader.module.css'

type ViewerHeaderProps = {
  board: PublicBoard
}

// Шапка страницы зрителя: слева стример и два статуса (на месте ли он и принимает ли заказы),
// справа кнопка «Предложить задачу». Кнопка есть, только если стример указал ссылку на донат.
export function ViewerHeader(props: ViewerHeaderProps) {
  const { board } = props
  const name = board.streamerName ?? 'Стример'
  // Без DonationAlerts донат не станет карточкой — для зрителя это та же пауза
  const isTakingOrders = board.intakeOpen && board.donationsConnected

  return (
    <div className={styles.header}>
      <div className={styles.profile}>
        {board.streamerAvatarUrl ? (
          <img className={styles.avatar} src={board.streamerAvatarUrl} alt="" />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {name[0].toUpperCase()}
          </span>
        )}
        <div className={styles.info}>
          <h1 className={styles.name}>{name}</h1>
          <PresenceStatus isOnline={board.streamerOnline} lastSeenAt={board.streamerLastSeenAt} />
          <IntakeStatus isTakingOrders={isTakingOrders} isStreamerOnline={board.streamerOnline} />
        </div>
      </div>

      {board.donationUrl && (
        <div className={styles.side}>
          <a
            className={`${styles.suggestButton} ${isTakingOrders ? '' : styles.paused}`}
            href={board.donationUrl}
            // noopener noreferrer: открытая страница не получит доступа к этой вкладке
            target="_blank"
            rel="noopener noreferrer"
          >
            {isTakingOrders ? <PlusCircleIcon /> : <span className={styles.buttonPause} aria-hidden="true" />}
            Предложить задачу
          </a>
          {!isTakingOrders && (
            <span className={styles.pausedHint}>Приём на паузе: донат сейчас не станет заказом</span>
          )}
        </div>
      )}
    </div>
  )
}

type PresenceStatusProps = {
  isOnline: boolean
  lastSeenAt: string
}

// «Стример на месте» — у него открыта доска; иначе «отошёл» и когда был
function PresenceStatus(props: PresenceStatusProps) {
  const { isOnline, lastSeenAt } = props
  const timeAgo = useTimeAgo(lastSeenAt)
  // formatTimeAgo пишет «меньше минуты» без «назад» — для «был …» его не хватает
  const seenAgo = timeAgo === 'меньше минуты' ? 'меньше минуты назад' : timeAgo

  return (
    <p className={styles.status}>
      <span className={styles.statusIcon}>
        <span className={`${styles.dot} ${isOnline ? styles.online : ''}`} />
      </span>
      {isOnline ? (
        <span>
          <b>Стример на месте</b> <span className={styles.secondary}>· видит заказы прямо сейчас</span>
        </span>
      ) : (
        <span>
          <b>Стример отошёл</b> <span className={styles.secondary}>· был {seenAgo}</span>
        </span>
      )}
    </p>
  )
}

type IntakeStatusProps = {
  isTakingOrders: boolean
  isStreamerOnline: boolean
}

// Принимает ли стример заказы: галочка или жёлтая пауза, как в шапке у стримера
function IntakeStatus(props: IntakeStatusProps) {
  const { isTakingOrders, isStreamerOnline } = props

  if (!isTakingOrders) {
    return (
      <p className={styles.status}>
        <span className={styles.statusIcon}>
          <span className={styles.pause} />
        </span>
        <span>
          <b className={styles.warning}>Приём заказов на паузе</b>{' '}
          <span className={styles.secondary}>· донаты сейчас не становятся заказами</span>
        </span>
      </p>
    )
  }

  return (
    <p className={styles.status}>
      <span className={`${styles.statusIcon} ${styles.check}`}>✓</span>
      {isStreamerOnline ? (
        <span>Принимает заказы</span>
      ) : (
        <span>
          Заказы принимаются <span className={styles.secondary}>· стример увидит их, когда вернётся</span>
        </span>
      )}
    </p>
  )
}
