# Сервер

Как сайт работает на настоящем сервере и как его туда поставить.

```
Интернет ──https──► web (Caddy + фронт) ──► backend (FastAPI) ──► postgres
                                                                    ▲
                                               backup (копия базы каждую ночь)
```

Всё запускается в Docker одной командой из этой папки. Файлы:

- `docker-compose.yml` — какие контейнеры работают и как связаны;
- `Caddyfile` — веб-сервер: HTTPS, файлы фронта, пересылка `/api` бэкенду;
- `web.Dockerfile` — сборка фронта и Caddy в один образ (бэкенд собирается по `backend/Dockerfile`);
- `backup.sh` — ночные бэкапы базы;
- `setup-server.sh` — первая настройка чистого сервера;
- `.env.example` — пример настроек: домен, пароль базы, ключи DonationAlerts.

После каждого мёржа в `main` сайт обновляется сам (`.github/workflows/deploy.yml`).

## Первый запуск

### 1. Сервер и домен

- **Сервер (VPS)**: Ubuntu 24.04, 2 ядра, 2–4 ГБ памяти. При создании добавь свой SSH-ключ
  (у провайдера это поле «SSH-ключ»). Если ключа нет, сделай его в PowerShell: `ssh-keygen -t ed25519`
  (на вопросы жми Enter), а в поле вставь содержимое файла `C:\Users\<ты>\.ssh\id_ed25519.pub`.
- **Домен**: у регистратора домена добавь DNS-запись типа `A`: имя `@`, значение — IP сервера.
  И ещё одну такую же с именем `www`: адрес с www будет перекидывать на основной.
  Запись начинает работать не сразу, проверить можно командой `ping <домен>` — должен ответить IP сервера.

### 2. Настройка сервера

Зайди на сервер из PowerShell: `ssh root@<IP сервера>`, и выполни:

```bash
curl -fsSL https://raw.githubusercontent.com/StepanZverev/donation-kanban/main/deploy/setup-server.sh | bash
```

В конце скрипт напечатает три значения. Впиши их в GitHub: репозиторий → Settings →
Secrets and variables → Actions → New repository secret, имена `DEPLOY_HOST`,
`DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`.

### 3. DonationAlerts

На https://www.donationalerts.com/application/clients в нашем приложении добавь Redirect URL
`https://<домен>/api/auth/callback`.

### 4. Запуск

Дальше работаем под пользователем `deploy` (root больше не нужен):

```bash
ssh deploy@<IP сервера>
cd donation-kanban/deploy
cp .env.example .env
nano .env        # впиши домен, пароль базы, ключи DA и ключ шифрования; сохранить — Ctrl+O, Enter, выйти — Ctrl+X
docker compose up -d --build
```

Через пару минут сайт откроется по `https://<домен>`. Сертификат Caddy получит сам при первом запуске.

### Ключ шифрования токенов

Токены DonationAlerts лежат в базе зашифрованными. Ключ — строка `TOKEN_ENCRYPTION_KEY` в `.env`.
Без неё `docker compose up` остановится с ошибкой и не тронет работающий сайт. Добавить ключ на уже
работающий сервер:

```bash
cd ~/donation-kanban/deploy
echo "TOKEN_ENCRYPTION_KEY=$(python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')" >> .env
grep -c TOKEN_ENCRYPTION_KEY .env   # должно вывести 1
```

Скопируй ключ в менеджер паролей (`grep TOKEN_ENCRYPTION_KEY .env` покажет его — не на стриме):
в бэкапах базы ключа нет. Потеря ключа не страшна для досок, но всем стримерам придётся заново
войти через DonationAlerts.

## Полезные команды

Все — на сервере, в папке `~/donation-kanban/deploy`:

| что | команда |
|---|---|
| что запущено | `docker compose ps` |
| логи бэкенда (выход — Ctrl+C) | `docker compose logs -f backend` |
| перезапустить всё | `docker compose restart` |
| обновить вручную | `git -C .. pull && docker compose up -d --build` |
| зайти в базу | `docker compose exec postgres psql -U donation_kanban` |

## Бэкапы

Каждую ночь в 04:00 по Москве копия базы ложится в `deploy/backups` на сервере, хранятся последние 14.
Копию можно скачать к себе (PowerShell, на своём компьютере):

```powershell
scp deploy@<IP сервера>:donation-kanban/deploy/backups/<файл>.dump .
```

Копии лежат на том же сервере: от ошибки в данных спасут, а от поломки самого сервера — нет.
Когда пользователей станет больше, стоит отправлять их ещё и в облачное хранилище.

**Восстановить базу из копии** (всё, что было в базе, заменится копией):

```bash
docker compose stop backend
docker compose exec -T postgres pg_restore -U donation_kanban -d donation_kanban --clean --if-exists < backups/<файл>.dump
docker compose start backend
```
