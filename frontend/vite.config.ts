import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Все запросы на /api фронт в режиме разработки пересылает на бэкенд,
    // поэтому в коде можно писать просто fetch('/api/...') без адреса сервера.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
