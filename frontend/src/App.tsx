import { Navigate, Route, Routes } from 'react-router'
import { AppHeader } from './components/AppHeader/AppHeader'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'
import { SETTINGS_SECTIONS } from './pages/SettingsPage/settingsSections'

function App() {
  return (
    <main className="app">
      <AppHeader />

      {/* Какую страницу показать, зависит от адреса в браузере */}
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/history" element={<HistoryPage />} />
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
