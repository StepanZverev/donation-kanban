import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { LOGIN_URL } from '../../api/auth'
import { APP_VERSION } from '../../changelog'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { WhatsNewDialog } from '../WhatsNewDialog/WhatsNewDialog'
import styles from './AccountMenu.module.css'

type AccountMenuProps = {
  // Значок справа от ника на кнопке и часть выпадашки под именем.
  // Их передаёт StreamerAccountMenu на своей доске; гостю они не показываются:
  // донатов у гостя нет, следить не за чем.
  indicator?: ReactNode
  streamSection?: ReactNode
}

// Кто вошёл — в правом углу шапки. Гость видит «Гость» и по клику подсказку,
// что доску стоит закрепить за собой через DonationAlerts. Вошедший — аватар,
// имя и кнопку «Выйти». Внизу — версия приложения, по клику окно «Что нового».
export function AccountMenu({ indicator, streamSection }: AccountMenuProps) {
  const { user, logout } = useCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false)

  // Бэкенд не отвечает — об этом и так скажет доска
  if (user === null) {
    return null
  }

  const displayName = user.isGuest ? 'Гость' : (user.name ?? 'Без имени')

  const avatar = user.avatarUrl ? (
    <img className={styles.avatar} src={user.avatarUrl} alt="" />
  ) : (
    // Без аватара — первая буква имени в кружке
    <span className={styles.avatar} aria-hidden="true">
      {displayName[0]}
    </span>
  )

  return (
    <>
      {/* onBlur на обёртке: фокус ушёл за пределы выпадашки (кликнули мимо) — закрываем
          Esc закрывает выпадашку */}
      <div className={styles.wrapper} onBlur={handleBlur} onKeyDown={handleKeyDown}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={isOpen}
          title={displayName}
          onClick={() => setIsOpen(!isOpen)}
        >
          {avatar}
          <span className={styles.name}>{displayName}</span>
          {!user.isGuest && indicator && <span className={styles.indicator}>{indicator}</span>}
        </button>

        {isOpen && (
          <div className={styles.dropdown}>
            <div className={styles.who}>
              {avatar}
              <span className={styles.whoText}>
                <span className={styles.heading}>{displayName}</span>
                <span className={styles.description}>
                  {user.isGuest ? 'Доска запомнена только в этом браузере' : 'Вход через DonationAlerts'}
                </span>
              </span>
            </div>

            {user.isGuest ? (
              <>
                <p className={styles.description}>
                  Если почистить cookie, доска потеряется. Подключи DonationAlerts, чтобы донаты
                  приходили на доску, а её можно было открыть с других устройств.
                </p>
                {user.canConnectDonationAlerts && (
                  <a className={styles.connectButton} href={LOGIN_URL}>
                    Подключить DonationAlerts
                  </a>
                )}
              </>
            ) : (
              streamSection
            )}

            {/* Доски, где пользователь модератор, и путь назад к своей */}
            {user.moderatedBoards.length > 0 && (
              <nav className={styles.boards} aria-label="Доски">
                <Link className={styles.boardLink} to={`/boards/${user.boardId}`} onClick={handleBoardClick}>
                  Моя доска
                </Link>
                {user.moderatedBoards.map((board) => (
                  <Link
                    key={board.id}
                    className={styles.boardLink}
                    to={`/boards/${board.id}`}
                    onClick={handleBoardClick}
                  >
                    Доска {board.ownerName ?? 'стримера'} · модератор
                  </Link>
                ))}
              </nav>
            )}

            {/* Низ меню: «Выйти» слева, версия справа. Гостю выйти нельзя — доска потеряется */}
            <div className={styles.footer}>
              {!user.isGuest && (
                <button type="button" className={styles.logoutButton} onClick={handleLogoutClick}>
                  Выйти
                </button>
              )}
              <button type="button" className={styles.versionButton} onClick={handleVersionClick}>
                Версия {APP_VERSION} · что нового
              </button>
            </div>
          </div>
        )}
      </div>

      {isWhatsNewOpen && <WhatsNewDialog onClose={() => setIsWhatsNewOpen(false)} />}
    </>
  )

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // relatedTarget — элемент, куда ушёл фокус. Если он внутри выпадашки, не закрываем.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function handleVersionClick() {
    setIsOpen(false)
    setIsWhatsNewOpen(true)
  }

  function handleBoardClick() {
    setIsOpen(false)
  }

  function handleLogoutClick() {
    if (window.confirm('Выйти на этом устройстве? Вернуться можно через DonationAlerts.')) {
      logout()
    }
  }
}
