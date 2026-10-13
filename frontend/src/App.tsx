import { Navigate, Route, Routes } from 'react-router'
import { AppHeader } from './components/AppHeader/AppHeader'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'
import { SettingsPage } from './pages/SettingsPage/SettingsPage'

function App() {
  return (
    <main className="app">
      <AppHeader />

      {/* Какую страницу показать, зависит от адреса в браузере */}
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Любой неизвестный адрес отправляем на доску */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

export default App
