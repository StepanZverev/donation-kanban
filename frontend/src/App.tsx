import { useEffect, useState } from 'react'
import { fetchHealth } from './api/health'

type BackendState = 'checking' | 'online' | 'offline'

const backendStateLabels: Record<BackendState, string> = {
  checking: 'проверяю…',
  online: 'работает',
  offline: 'недоступен',
}

function App() {
  const [backendState, setBackendState] = useState<BackendState>('checking')

  useEffect(() => {
    fetchHealth()
      .then(() => setBackendState('online'))
      .catch(() => setBackendState('offline'))
  }, [])

  return (
    <main className="app">
      <h1>Менеджер донатов</h1>
      <p>
        Бэкенд: <span className={`status status--${backendState}`}>{backendStateLabels[backendState]}</span>
      </p>
    </main>
  )
}

export default App
