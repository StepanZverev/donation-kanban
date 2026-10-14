import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AppHeader } from './components/AppHeader/AppHeader'
import { useNewDonations } from './hooks/useNewDonations'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { SETTINGS_SECTIONS } from './pages/SettingsPage/settingsSections'

function App() {
  // Пришли ли донаты, пока стример был на другой вкладке: точки в навигации и подсветка
  const { pathname } = useLocation()
  const newDonations = useNewDonations(pathname)

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
    </main>
  )
}

export default App
