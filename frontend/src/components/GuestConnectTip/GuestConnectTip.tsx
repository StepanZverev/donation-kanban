import { useState } from 'react'
import { LOGIN_URL } from '../../api/auth'
import { readSaved, save } from '../../utils/storage'
import { CloseIcon } from '../Icons/Icons'
import styles from './GuestConnectTip.module.css'

// Под этим ключом браузер помнит, что гость закрыл подсказку крестиком
const HIDDEN_KEY = 'guestConnectTipHidden'

// Подсказка гостю под кнопкой аккаунта: доска уже работает, но донаты сами
// не приходят, пока не подключён DonationAlerts. Крестик прячет её в этом браузере.
export function GuestConnectTip() {
  const [isHidden, setIsHidden] = useState(() => readSaved(HIDDEN_KEY) === 'yes')

  if (isHidden) {
    return null
  }

  return (
    <div className={styles.tip} role="note">
      <p className={styles.text}>
        Подключи DonationAlerts, чтобы донаты сами появлялись на доске, а её можно было открыть с любого
        устройства.
      </p>
      <a className={styles.connectButton} href={LOGIN_URL}>
        Подключить
      </a>
      <button
        type="button"
        className={styles.closeButton}
        title="Скрыть подсказку"
        aria-label="Скрыть подсказку"
        onClick={handleClose}
      >
        <CloseIcon />
      </button>
    </div>
  )

  function handleClose() {
    save(HIDDEN_KEY, 'yes')
    setIsHidden(true)
  }
}
