import { Navigate, Route, Routes } from 'react-router'
import { Navigation } from './components/Navigation/Navigation'
import { BoardPage } from './pages/BoardPage/BoardPage'
import { HistoryPage } from './pages/HistoryPage/HistoryPage'

function App() {
  return (
    <main className="app">
      <h1>Менеджер донатов</h1>
      <Navigation />

      {/* Какую страницу показать, зависит от адреса в браузере */}
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        {/* Любой неизвестный адрес отправляем на доску */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

export default App
