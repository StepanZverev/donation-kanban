import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Явно слушаем IPv4-адрес. Без этого на Windows Vite может занять только
    // IPv6 (::1), и браузер или VPN получат «connection refused».
    // Открывать фронт: http://127.0.0.1:5173
    host: '127.0.0.1',
    port: 5173,
    // Все запросы на /api фронт в режиме разработки пересылает на бэкенд,
    // поэтому в коде можно писать просто fetch('/api/...') без адреса сервера.
    // Адрес 127.0.0.1, а не localhost: на Windows localhost может уйти в IPv6 (::1),
    // а uvicorn по умолчанию слушает только IPv4.
    // ws: true — пересылать и WebSocket-соединения (живые обновления доски).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', ws: true },
    },
  },
})
