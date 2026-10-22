import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MODERATOR_NICKNAME_MAX_LENGTH } from '../../defaults'
import { useInvite } from '../../hooks/useInvite'
import styles from './InvitePage.module.css'

// Страница приглашения: /invite/<токен>. Стример зовёт помогать вести его доску.
// Принять может и гость: тогда доступ живёт в этом браузере, пока не почистишь cookie.
export function InvitePage() {
  // Токен — секретная часть ссылки после /invite/
  const { token = '' } = useParams()
  const { state, isAccepting, accept } = useInvite(token)
  const navigate = useNavigate()
  // Как назвать модератора: стример увидит это имя в списке модераторов
  const [nickname, setNickname] = useState('')

  if (state.status === 'loading') {
    return <p className="app-message">Открываю приглашение…</p>
  }
  if (state.status === 'error') {
    return <p className="app-message">Не удалось открыть приглашение. Попробуй обновить страницу.</p>
  }
  if (state.status === 'broken') {
    return (
      <p className="app-message">
        Приглашение не работает: стример его выключил или заменил на новое. Попроси новую ссылку.
      </p>
    )
  }

  const { invite } = state
  const streamer = invite.ownerName ?? 'Стример'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {invite.role === null ? (
          <>
            <h1 className={styles.title}>{streamer} зовёт тебя в модераторы</h1>
            <p className={styles.text}>
              Ты сможешь двигать, править и убирать карточки на его доске. Настройки доски
              останутся у стримера.
            </p>
            <label className={styles.field}>
              <span className={styles.label}>Как тебя называть</span>
              <input
                className={styles.input}
                value={nickname}
                maxLength={MODERATOR_NICKNAME_MAX_LENGTH}
                placeholder="Например, ник в чате"
                onChange={(event) => setNickname(event.target.value)}
              />
              <span className={styles.note}>
                Так тебя увидит стример в списке модераторов. Можно оставить пустым, тогда будет
                «Гость».
              </span>
            </label>
            <button
              type="button"
              className={styles.acceptButton}
              disabled={isAccepting}
              onClick={handleAcceptClick}
            >
              Принять
            </button>
            <p className={styles.note}>
              Входить не обязательно. Но без входа через DonationAlerts доступ запомнится только в
              этом браузере.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>
              {invite.role === 'owner' ? 'Это твоя доска' : 'Ты уже модератор этой доски'}
            </h1>
            <Link className={styles.acceptButton} to={`/boards/${invite.boardId}`}>
              Открыть доску
            </Link>
          </>
        )}
      </div>
    </div>
  )

  async function handleAcceptClick() {
    const boardId = await accept(nickname)
    navigate(`/boards/${boardId}`)
  }
}
