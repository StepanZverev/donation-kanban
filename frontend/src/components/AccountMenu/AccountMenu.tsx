import { useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { LOGIN_URL } from '../../api/auth'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import styles from './AccountMenu.module.css'

// Кто вошёл — в правом углу шапки. Гость видит «Гость» и по клику подсказку,
// что доску стоит закрепить за собой через DonationAlerts. Вошедший — аватар,
// имя и кнопку «Выйти».
export function AccountMenu() {
  const { user, logout } = useCurrentUser()
  const [isOpen, setIsOpen] = useState(false)

  // Бэкенд не отвечает — об этом и так скажет доска
  if (user === null) {
    return null
  }

  const displayName = user.isGuest ? 'Гость' : (user.name ?? 'Без имени')

  return (
    // onBlur на обёртке: фокус ушёл за пределы выпадашки (кликнули мимо) — закрываем
    // Esc закрывает выпадашку
    <div className={styles.wrapper} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={isOpen}
        title={displayName}
        onClick={() => setIsOpen(!isOpen)}
      >
        {user.avatarUrl ? (
          <img className={styles.avatar} src={user.avatarUrl} alt="" />
        ) : (
          // Без аватара — первая буква имени в кружке
          <span className={styles.avatar} aria-hidden="true">
            {displayName[0]}
          </span>
        )}
        <span className={styles.name}>{displayName}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {user.isGuest ? (
            <>
              <p className={styles.heading}>Ты пользуешься доской как гость</p>
              <p className={styles.description}>
                Доска запомнена только в этом браузере: если почистить cookie, она потеряется.
                Подключи DonationAlerts, чтобы закрепить доску за собой и открывать её с других
                устройств.
              </p>
              {user.canConnectDonationAlerts && (
                <a className={styles.connectButton} href={LOGIN_URL}>
                  Подключить DonationAlerts
                </a>
              )}
            </>
          ) : (
            <>
              <p className={styles.heading}>{displayName}</p>
              <p className={styles.description}>Вход через DonationAlerts.</p>
              <button type="button" className={styles.logoutButton} onClick={handleLogoutClick}>
                Выйти
              </button>
            </>
          )}

          {/* Доски, где пользователь модератор, и путь назад к своей */}
          {user.moderatedBoards.length > 0 && (
            <nav className={styles.boards} aria-label="Доски">
              <p className={styles.heading}>Доски</p>
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
        </div>
      )}
    </div>
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

  function handleBoardClick() {
    setIsOpen(false)
  }

  function handleLogoutClick() {
    if (window.confirm('Выйти на этом устройстве? Вернуться можно через DonationAlerts.')) {
      logout()
    }
  }
}
