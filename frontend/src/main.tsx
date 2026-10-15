import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { getMe } from './api/me'
import App from './App.tsx'
import { followSystemTheme } from './utils/theme'

// Тема «как в системе» должна переключаться вместе с системой, пока приложение открыто
followSystemTheme()

// Сначала спрашиваем бэкенд, кто открыл сайт: в первый визит он создаёт гостя
// и ставит cookie. Рисуем приложение только после этого — иначе первые запросы доски
// ушли бы разом без cookie, и каждый создал бы своего гостя со своей пустой доской.
// Зрителю (страница /v/…) гость не нужен: он только смотрит чужую доску.
const isViewerPage = window.location.pathname.startsWith('/v/')
if (isViewerPage) {
  renderApp()
} else {
  getMe()
    .catch(() => null) // бэкенд не отвечает — об этом скажет сама доска
    .then(renderApp)
}

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* BrowserRouter следит за адресом в браузере и даёт работать Routes и NavLink */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
