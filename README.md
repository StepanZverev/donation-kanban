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
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Фронтенд** (http://localhost:5173), в отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Фронт пересылает запросы `/api/*` на бэкенд (см. `frontend/vite.config.ts`). Если на странице написано «Бэкенд: работает», всё связано правильно.
