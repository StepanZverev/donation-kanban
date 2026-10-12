import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* BrowserRouter следит за адресом в браузере и даёт работать Routes и NavLink */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
