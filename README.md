# Donation Kanban

Менеджер донатов для стримеров и модераторов: донаты из DonationAlerts превращаются в карточки на канбан-доске.

- `frontend/` — React + TypeScript (Vite)
- `backend/` — Python, FastAPI

## Запуск в режиме разработки

Понадобятся Node.js 20+ и Python 3.11+.

**Бэкенд** (http://localhost:8000, документация API на http://localhost:8000/docs):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

**Фронтенд** (http://localhost:5173), в отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Фронт пересылает запросы `/api/*` на бэкенд (см. `frontend/vite.config.ts`). Если на странице написано «Бэкенд: работает», всё связано правильно.

## Тесты бэкенда

```bash
cd backend
source .venv/bin/activate
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

Статусы: `queue` (в очереди), `in_progress` (в работе), `done` (выполнено).
