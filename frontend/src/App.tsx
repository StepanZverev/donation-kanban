import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AppHeader } from './components/AppHeader/AppHeader'
import { FakeDonationButton } from './components/FakeDonationButton/FakeDonationButton'
import { useDonationSound } from './hooks/useDonationSound'
import { useNewDonations } from './hooks/useNewDonations'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { ViewerPage } from './pages/ViewerPage/ViewerPage'
import { SETTINGS_SECTIONS } from './pages/SettingsPage/settingsSections'

function App() {
  return (
    <Routes>
      {/* Страница для зрителей — отдельно от приложения стримера: без шапки,
          без звука донатов и без запросов к доске стримера */}
      <Route path="/v/:token" element={<ViewerPage />} />
      <Route path="*" element={<StreamerApp />} />
    </Routes>
  )
}

// Приложение стримера: шапка и страницы доски, истории и настроек
function StreamerApp() {
  // Пришли ли донаты, пока стример был на другой вкладке: точки в навигации и подсветка
  const { pathname } = useLocation()
  const newDonations = useNewDonations(pathname)
  // Звук нового доната — на любой вкладке
  useDonationSound(newDonations.latestOnBoard)

  return (
    <main className="app">
      <AppHeader
        hasNewOnBoard={newDonations.hasNewOnBoard}
        hasNewInHistory={newDonations.hasNewInHistory}
      />

      {/* Какую страницу показать, зависит от адреса в браузере */}
      <Routes>
        <Route path="/" element={<BoardPage seenAt={newDonations.boardSeenAt} />} />
        <Route path="/history" element={<HistoryPage seenAt={newDonations.historySeenAt} />} />
        {/* У настроек свои адреса для разделов: /settings/columns, /settings/appearance… */}
        <Route path="/settings" element={<SettingsPage />}>
          {/* /settings без раздела — открываем первый */}
          <Route index element={<Navigate to={SETTINGS_SECTIONS[0].path} replace />} />
          {SETTINGS_SECTIONS.map((section) => (
            <Route key={section.path} path={section.path} element={section.element} />
          ))}
        </Route>
        {/* Любой неизвестный адрес отправляем на доску */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Только для проверки без настоящих донатов, потом уберём */}
      <FakeDonationButton />
    </main>
  )
}

export default App
