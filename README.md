# Donation Kanban

Менеджер донатов для стримеров и модераторов: донаты из DonationAlerts превращаются в карточки на канбан-доске.

- `frontend/` — React + TypeScript (Vite)
- `backend/` — Python, FastAPI

## Запуск в режиме разработки

Понадобятся Node.js 20+ и Python 3.11+.

**Бэкенд** (http://localhost:8000, документация API на http://localhost:8000/docs):

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Если PowerShell пишет, что выполнение сценариев отключено, один раз выполни
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` и повтори активацию.
После активации в начале строки терминала появится `(.venv)`.

**Фронтенд** (http://127.0.0.1:5173), в отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Фронт пересылает запросы `/api/*` на бэкенд (см. `frontend/vite.config.ts`). Если на странице написано «Бэкенд: работает», всё связано правильно.

## Подключение DonationAlerts

1. Зайди на https://www.donationalerts.com/application/clients и создай приложение.
   В поле Redirect URL укажи `http://127.0.0.1:8000/api/auth/callback`
   (если форма не примет такой адрес, укажи `http://localhost:8000/api/auth/callback`).
2. Скопируй `backend/.env.example` в `backend/.env` и впиши туда `DA_CLIENT_ID` и `DA_CLIENT_SECRET`.
   `DA_REDIRECT_URI` должен в точности совпадать с адресом из шага 1.
   Файл `.env` в git не попадает, ключи никому не отправляй.
3. Перезапусти бэкенд и нажми «Подключить» в шапке доски. После входа в DonationAlerts тебя вернёт на доску.

Новые донаты сразу появятся в «В очереди». Если бэкенд был выключен, при запуске он доберёт донаты,
пришедшие за это время. Старые донаты, пришедшие до первого подключения, не загружаются.

## Тесты бэкенда

```bash
cd backend
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pytest
```

## API

Полный список с возможностью отправить запрос прямо из браузера: http://localhost:8000/docs

| Метод и путь | Что делает |
|---|---|
| `GET /api/cards` | карточки на доске |
| `POST /api/cards` | создать карточку (`title`, `description`, `status`) |
| `PATCH /api/cards/{id}` | изменить `title` и/или `description` |
| `POST /api/cards/{id}/move` | переместить в колонку `status` на место `position` (0 — верх) |
| `DELETE /api/cards/{id}` | убрать с доски в историю |
| `GET /api/history` | история, сначала новые |
| `POST /api/history/{id}/restore` | вернуть из истории в «В очереди» |
| `DELETE /api/history/{id}` | удалить из истории насовсем |
| `POST /api/dev/fake-donation` | создать карточку из случайного выдуманного доната (для проверки) |
| `GET /api/auth/status` | подключён ли DonationAlerts и что делает приёмник донатов |
| `GET /api/auth/login` | перейти на вход в DonationAlerts |
| `GET /api/auth/callback` | сюда DonationAlerts возвращает после входа |
| `POST /api/auth/logout` | отключить DonationAlerts |
| `WS /api/ws` | WebSocket: сервер шлёт `{"type": "board_changed"}` при любом изменении доски |

Статусы: `queue` (в очереди), `in_progress` (в работе), `done` (выполнено).
