import { useState, type FormEvent } from 'react'
import type { CurrentUser } from '../../api/me'
import { MODERATOR_NICKNAME_MAX_LENGTH } from '../../defaults'
import { useBoard } from '../../hooks/useBoard'
import { useDonationAlertsStatus } from '../../hooks/useDonationAlertsStatus'
import { useMyNickname } from '../../hooks/useMyNickname'
import { AccountMenu } from '../AccountMenu/AccountMenu'
import { DonationAlertsRow } from '../DonationAlertsRow/DonationAlertsRow'
import { SwordIcon } from '../Icons/Icons'
import styles from './ModeratorAccountMenu.module.css'

type ModeratorAccountMenuProps = {
  user: CurrentUser
  onLogout: () => void
}

// Меню аккаунта на чужой доске, где пользователь модератор.
// На кнопке «Модератор: <имя>» и фиолетовый меч. Имя — то, которым он представился на этой доске;
// в выпадашке его можно поменять (или взять из DonationAlerts). Там же его собственный
// DonationAlerts: подключён ли и кнопка «Отключить». Статус донатов и приём — дело стримера, их здесь нет.
export function ModeratorAccountMenu({ user, onLogout }: ModeratorAccountMenuProps) {
  const board = useBoard()
  const { nickname, error, saveNickname } = useMyNickname()
  const { status, disconnect } = useDonationAlertsStatus()
  // Что написано в поле имени. null — поле не трогали, показываем сохранённое имя.
  const [nicknameDraft, setNicknameDraft] = useState<string | null>(null)

  const ownerName = board.ownerName ?? 'стримера'
  // Не представился — стример видит имя из DonationAlerts, а у гостя «Гость»
  const displayName = nickname ?? user.name ?? 'Гость'
  const nicknameInput = nicknameDraft ?? nickname ?? ''

  return (
    <AccountMenu
      user={user}
      onLogout={onLogout}
      name={displayName}
      namePrefix="Модератор:"
      title={`Ты модератор доски ${ownerName}`}
      subtitle={`Модератор доски ${ownerName}`}
      indicator={
        <span className={styles.sword}>
          <SwordIcon />
        </span>
      }
      guestHint="Ты зашёл без входа: доступ запомнен только в этом браузере. Подключи DonationAlerts, чтобы не потерять его и открывать доску с других устройств."
    >
      <p className={styles.description}>
        Ты помогаешь вести доску: двигаешь, правишь и убираешь карточки. Настройки и колонки остаются у
        стримера.
      </p>

      <form className={styles.section} onSubmit={handleNicknameSubmit}>
        <label className={styles.label} htmlFor="my-nickname">
          Как тебя называть
        </label>
        <div className={styles.inputRow}>
          <input
            id="my-nickname"
            className={styles.input}
            maxLength={MODERATOR_NICKNAME_MAX_LENGTH}
            autoComplete="off"
            placeholder={user.name ?? 'Например, Вася с чата'}
            value={nicknameInput}
            onChange={(event) => setNicknameDraft(event.target.value)}
          />
          <button type="submit" className="primary-button" disabled={nicknameDraft === null}>
            Сохранить
          </button>
        </div>
        {/* Имя из DonationAlerts — только у тех, кто через него вошёл */}
        {user.name && (
          <button type="button" className={styles.linkButton} onClick={() => setNicknameDraft(user.name)}>
            Взять из DonationAlerts: {user.name}
          </button>
        )}
        <span className={styles.hint}>Так тебя видит стример в списке модераторов.</span>
        {error && <span className={styles.error}>{error}</span>}
      </form>

      {/* Свой DonationAlerts — у тех, кто вошёл через него. Гостю AccountMenu сам предложит подключить. */}
      {!user.isGuest && status && (
        <DonationAlertsRow
          className={styles.daRow}
          status={status}
          note={status.connected ? `Подключён как ${user.name ?? 'ты'}` : 'Не подключён'}
          disconnectQuestion="Отключить DonationAlerts? Донаты перестанут приходить на твою собственную доску."
          onDisconnect={disconnect}
        />
      )}
    </AccountMenu>
  )

  async function handleNicknameSubmit(event: FormEvent<HTMLFormElement>) {
    // Без этого браузер перезагрузит страницу, отправляя форму
    event.preventDefault()
    if (nicknameDraft === null) {
      return
    }
    const isSaved = await saveNickname(nicknameDraft)
    // Сохранилось — поле снова показывает сохранённое имя
    if (isSaved) {
      setNicknameDraft(null)
    }
  }
}
