import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Все запросы на /api фронт в режиме разработки пересылает на бэкенд,
    // поэтому в коде можно писать просто fetch('/api/...') без адреса сервера.
    // Адрес 127.0.0.1, а не localhost: на Windows localhost может уйти в IPv6 (::1),
    // а uvicorn по умолчанию слушает только IPv4.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
