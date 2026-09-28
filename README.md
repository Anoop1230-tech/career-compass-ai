# Career Compass AI

Personalized career guidance and roadmap platform: "Given my current education, skills, interests, experience and goals, what can I do next?"

- [WORKFLOW.md](WORKFLOW.md): architecture and user/data workflow
- [PHASES.md](PHASES.md): build plan and progress
- [docs/DATA_REQUIREMENTS.md](docs/DATA_REQUIREMENTS.md): dataset design

## Tech stack

- Frontend: React 19, Vite 8, React Router 7, Axios
- Backend: Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2
- Database: SQLite (dev), PostgreSQL (production)
- Testing: pytest, Vitest + React Testing Library, Playwright
- Data/ML: Pandas, NumPy, scikit-learn, Matplotlib, Seaborn

## First-time setup (Windows PowerShell)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
cd ..

# Frontend + root tools
npm install
npm --prefix frontend install
copy frontend\.env.example frontend\.env
npx --prefix frontend playwright install chromium
```

## Run

Double-click `start-dev.bat`, or from the project root:

```powershell
npm run dev
```

This starts both servers in one terminal. Open http://localhost:5173. The footer shows "Server online" when the backend is connected. API docs are at http://localhost:8000/docs.

## Test

```powershell
npm test            # everything: backend + frontend unit + browser tests
npm run test:api    # backend (pytest)
npm run test:web    # frontend unit tests (Vitest)
npm run test:e2e    # browser tests, desktop + mobile (Playwright)
npm run lint
npm run build
```

## How the frontend talks to the backend

The browser only talks to `http://localhost:5173`. Requests to `/api/...` are forwarded by the Vite dev server to FastAPI on `http://127.0.0.1:8000`, so there are no CORS or localhost/127.0.0.1 problems.
