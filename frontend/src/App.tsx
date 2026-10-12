import { useState } from 'react'
import { Board } from './components/Board/Board'
import { History } from './components/History/History'
import { Tabs } from './components/Tabs/Tabs'

type Page = 'board' | 'history'

const pages: { id: Page; label: string }[] = [
  { id: 'board', label: 'Доска' },
  { id: 'history', label: 'История' },
]

function App() {
  const [page, setPage] = useState<Page>('board')

  return (
    <main className="app">
      <h1>Менеджер донатов</h1>
      <Tabs tabs={pages} activeTab={page} onChange={setPage} />

      {/* Каждая вкладка при открытии сама загружает свежие данные с сервера */}
      {page === 'board' && <Board />}
      {page === 'history' && <History />}
    </main>
  )
}

export default App
