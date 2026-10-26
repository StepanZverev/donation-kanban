# Образ сайта: собранный фронт + Caddy (веб-сервер, который сам получает HTTPS-сертификат).
# Собирается из корня проекта (context: .. в deploy/docker-compose.yml).

# Шаг 1: собираем фронт в обычные файлы (frontend/dist)
FROM node:22-alpine AS build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Шаг 2: берём только готовые файлы, Node.js на сервере не нужен
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /frontend/dist /srv
