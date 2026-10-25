import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import type { CurrentUser } from './api/me'
import { AppHeader } from './components/AppHeader/AppHeader'
import { FakeDonationButton } from './components/FakeDonationButton/FakeDonationButton'
import { BoardContext, useBoard } from './hooks/useBoard'
import { useBoardInfo } from './hooks/useBoardInfo'
import { CurrentUserContext, useCurrentUser } from './hooks/useCurrentUser'
import { useDonationSound } from './hooks/useDonationSound'
import { useNewDonations } from './hooks/useNewDonations'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'
import { InvitePage } from './pages/InvitePage/InvitePage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { ViewerPage } from './pages/ViewerPage/ViewerPage'
import { SETTINGS_SECTIONS } from './pages/SettingsPage/settingsSections'

// Адреса приложения:
//   /boards/5, /boards/5/history, /boards/5/settings/… — доска с id 5 (своя или где ты модератор);
//   /invite/<токен> — приглашение стать модератором;
//   /v/<токен> — страница для зрителей;
//   всё остальное (/, старые /history и /settings) — на свою доску.
type AppProps = {
  // Кто открыл сайт — бэкенд ответил ещё до запуска приложения (см. main.tsx).
  // null — бэкенд не ответил (или это страница зрителя: там пользователь не нужен).
  initialUser: CurrentUser | null
}

function App({ initialUser }: AppProps) {
  const [user, setUser] = useState(initialUser)

  return (
    // Компоненты внутри берут пользователя через useCurrentUser()
    <CurrentUserContext.Provider value={{ user, setUser }}>
      <Routes>
        {/* Страница для зрителей — отдельно от приложения стримера: без шапки,
            без звука донатов и без запросов к доске стримера */}
        <Route path="/v/:token" element={<ViewerPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/boards/:boardId/*" element={<BoardRoute />} />
        <Route path="*" element={<OwnBoardRedirect />} />
      </Routes>
    </CurrentUserContext.Provider>
  )
}

// Отправляет на свою доску. Остаток адреса сохраняем: /history → /boards/5/history.
function OwnBoardRedirect() {
  const { pathname } = useLocation()
  const { user } = useCurrentUser()

  if (user === null) {
    return <p className="app-message">Не удалось загрузить доску. Проверь, что бэкенд запущен.</p>
  }
  const rest = pathname === '/' ? '' : pathname
  return <Navigate to={`/boards/${user.boardId}${rest}`} replace />
}

// Открывает доску из адреса: спрашивает бэкенд, есть ли к ней доступ и кто на ней пользователь
function BoardRoute() {
  const { boardId } = useParams()
  const boardInfo = useBoardInfo(Number(boardId))

  if (boardInfo.status === 'loading') {
    return <p className="app-message">Загружаю доску…</p>
  }
  if (boardInfo.status === 'error') {
    return <p className="app-message">Не удалось загрузить доску. Проверь, что бэкенд запущен.</p>
  }
  if (boardInfo.status === 'missing') {
    return (
      <p className="app-message">
        Этой доски нет, или у тебя к ней больше нет доступа. <Link to="/">Открыть свою доску</Link>
      </p>
    )
  }

  return (
    // Хуки и компоненты внутри берут доску через useBoard()
    <BoardContext.Provider value={boardInfo.board}>
      {/* key: при переходе на другую доску всё внутри начинается с чистого листа */}
      <StreamerApp key={boardInfo.board.id} />
    </BoardContext.Provider>
  )
}

// Приложение стримера (или модератора): шапка и страницы доски, истории и настроек
function StreamerApp() {
  const board = useBoard()
  // Адрес внутри доски: /boards/5/history → /history
  const { pathname } = useLocation()
  const boardPathname = pathname.replace(`/boards/${board.id}`, '') || '/'
  // Пришли ли донаты, пока стример был на другой вкладке: точки в навигации и подсветка
  const newDonations = useNewDonations(boardPathname)
  // Звук нового доната — на любой вкладке
  useDonationSound(newDonations.latestOnBoard)

  return (
    <main className="app">
      <AppHeader
        hasNewOnBoard={newDonations.hasNewOnBoard}
        hasNewInHistory={newDonations.hasNewInHistory}
      />

      {/* Какую страницу показать, зависит от адреса в браузере.
          Адреса здесь — продолжение /boards/<id>/ */}
      <Routes>
        <Route index element={<BoardPage seenAt={newDonations.boardSeenAt} />} />
        <Route path="history" element={<HistoryPage seenAt={newDonations.historySeenAt} />} />
        {/* Настройки — только у хозяина доски. У разделов свои адреса: settings/board… */}
        {board.role === 'owner' && (
          <Route path="settings" element={<SettingsPage />}>
            {/* settings без раздела — открываем первый */}
            <Route index element={<Navigate to={SETTINGS_SECTIONS[0].path} replace />} />
            {/* Раньше «Колонки» и «Уровни» были отдельными разделами — старые адреса ведут в «Доску» */}
            <Route path="columns" element={<Navigate to="../board" replace />} />
            <Route path="levels" element={<Navigate to="../board" replace />} />
            {SETTINGS_SECTIONS.map((section) => (
              <Route key={section.path} path={section.path} element={section.element} />
            ))}
          </Route>
        )}
        {/* Любой неизвестный адрес отправляем на доску */}
        <Route path="*" element={<Navigate to={`/boards/${board.id}`} replace />} />
      </Routes>

      {/* Только для проверки без настоящих донатов. import.meta.env.DEV — сайт запущен
          через npm run dev, то есть локально; в собранной для сервера версии кнопки нет */}
      {import.meta.env.DEV && <FakeDonationButton />}
    </main>
  )
}

export default App
