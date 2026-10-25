import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { LOGIN_URL } from '../../api/auth'
import { APP_VERSION } from '../../changelog'
import type { CurrentUser } from '../../api/me'
import { useBoard } from '../../hooks/useBoard'
import { WhatsNewDialog } from '../WhatsNewDialog/WhatsNewDialog'
import styles from './AccountMenu.module.css'

type AccountMenuProps = {
  // Кто вошёл и как выйти (см. useCurrentUser)
  user: CurrentUser
  onLogout: () => void
  // Имя на кнопке и в выпадашке. Без него — имя из DonationAlerts, у гостя «Гость».
  // Модератору сюда передают имя, которым он представился на доске.
  name?: string
  // Серая приписка перед именем на кнопке, например «Модератор:»
  namePrefix?: string
  // Подсказка при наведении на кнопку и подпись под именем в выпадашке
  title?: string
  subtitle?: string
  // Значок справа от имени на кнопке: точка статуса, пауза или меч
  indicator?: ReactNode
  // Что объяснить гостю над кнопкой «Подключить DonationAlerts»
  guestHint?: string
  // Середина выпадашки: то, что нужно на этой доске (статус DA, приём, имя модератора)
  children?: ReactNode
}

const DEFAULT_GUEST_HINT =
  'Если почистить cookie, доска потеряется. Подключи DonationAlerts, чтобы донаты приходили на доску, а её можно было открыть с других устройств.'

// Кто вошёл — в правом углу шапки. По клику выпадашка: кто вошёл, середина от того,
// кто её показывает (StreamerAccountMenu или ModeratorAccountMenu), список досок,
// внизу «Выйти» и версия приложения (по клику окно «Что нового»).
// Гостю вместо «Выйти» — подсказка и кнопка «Подключить DonationAlerts».
export function AccountMenu(props: AccountMenuProps) {
  const { user, onLogout, namePrefix, indicator, children } = props
  const currentBoard = useBoard()
  const [isOpen, setIsOpen] = useState(false)
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false)

  const displayName = props.name ?? (user.isGuest ? 'Гость' : (user.name ?? 'Без имени'))
  const subtitle =
    props.subtitle ?? (user.isGuest ? 'Доска запомнена только в этом браузере' : 'Вход через DonationAlerts')
  const guestHint = props.guestHint ?? DEFAULT_GUEST_HINT

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
          title={props.title ?? displayName}
          onClick={() => setIsOpen(!isOpen)}
        >
          {avatar}
          <span className={styles.name}>
            {namePrefix && <span className={styles.namePrefix}>{namePrefix} </span>}
            {displayName}
          </span>
          {indicator && <span className={styles.indicator}>{indicator}</span>}
        </button>

        {isOpen && (
          <div className={styles.dropdown}>
            <div className={styles.who}>
              {avatar}
              <span className={styles.whoText}>
                <span className={styles.heading}>{displayName}</span>
                <span className={styles.description}>{subtitle}</span>
              </span>
            </div>

            {children}

            {user.isGuest && (
              <>
                <p className={styles.description}>{guestHint}</p>
                {user.canConnectDonationAlerts && (
                  <a className={styles.connectButton} href={LOGIN_URL}>
                    Подключить DonationAlerts
                  </a>
                )}
              </>
            )}

            {/* Доски, где пользователь модератор, и путь назад к своей */}
            {user.moderatedBoards.length > 0 && (
              <nav className={styles.boards} aria-label="Доски">
                <Link
                  className={getBoardLinkClass(user.boardId)}
                  to={`/boards/${user.boardId}`}
                  onClick={handleBoardClick}
                >
                  Моя доска
                </Link>
                {user.moderatedBoards.map((board) => (
                  <Link
                    key={board.id}
                    className={getBoardLinkClass(board.id)}
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

  // Доска, которая сейчас открыта, выделена в списке
  function getBoardLinkClass(boardId: number) {
    return boardId === currentBoard.id ? `${styles.boardLink} ${styles.currentBoard}` : styles.boardLink
  }

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
      onLogout()
    }
  }
}
