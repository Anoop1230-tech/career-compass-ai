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

## Career and education data

The reference data lives in `datasets/*.csv` (field definitions in `docs/DATA_REQUIREMENTS.md`). From the `backend` folder:

```powershell
.\venv\Scripts\python.exe -m catalog.validator     # check every CSV (file, row and problem for each error)
.\venv\Scripts\python.exe -m catalog.link_check    # check every official URL opens (needs internet)
.\venv\Scripts\python.exe -m catalog.seed          # load into the database (also runs on server start)
.\venv\Scripts\python.exe -m catalog.seed --force  # reload even if unchanged
```

Loading is safe: invalid data changes nothing, the load is all-or-nothing, and user accounts and profiles are never touched. Edit a CSV and restart the server to see the change.

## Accounts and security

- Passwords are hashed with Argon2; the plain password is never stored.
- Login uses a signed token in an httpOnly, SameSite=Lax cookie (JavaScript cannot read it).
- `backend/.env` must contain a long random `SECRET_KEY` (see `.env.example`). The app refuses to start in production without one.
- Login/register are rate limited (10 attempts per minute per IP by default).
- Tests use their own temporary databases; browser tests use ports 8001/5174, so your dev data and running servers are never touched.

## API endpoints

| Method | Path | Login | Purpose |
|---|---|---|---|
| GET | /api/health | no | Server and database status |
| POST | /api/auth/register | no | Create account (logs in) |
| POST | /api/auth/login | no | Log in |
| POST | /api/auth/logout | no | Log out |
| GET | /api/auth/me | yes | Current user |
| GET | /api/profile/options | no | Choice lists for the profile form |
| GET / PUT / DELETE | /api/profile | yes | Read, save, delete your profile |
| GET | /api/catalog/stages?level= | no | Education and career stages |
| GET | /api/catalog/skills?q=&category=&limit= | no | Search skills (names and aliases) |
| GET | /api/catalog/careers?q=&domain=&stage=&limit=&offset= | no | Search and filter careers |
| GET | /api/catalog/careers/{id} | no | Career detail: skills, entry paths, next roles, switches |
| GET | /api/catalog/exams?q=&level=&stage= | no | Entrance exams with official links |
| GET | /api/catalog/exams/{id} | no | One exam |
| GET | /api/assessments | yes | The three tests with status (not started, in progress, completed) |
| POST | /api/assessments/{kind}/start?restart= | yes | Start or resume a test (aptitude answers are never sent) |
| POST | /api/assessments/{kind}/submit | yes | Submit answers and save the scores |
| GET | /api/assessments/results | yes | Latest result of every test taken |
| GET | /api/assessments/{kind}/result | yes | Latest result of one test (aptitude includes answer review) |
| GET | /api/next-steps?stage= | optional | Next steps from a stage (profile stage when logged in) |

`kind` is `interest`, `personality` or `aptitude`. Assessment results are for self-reflection and career guidance, not clinical or professional psychological assessments.

Full interactive docs: http://localhost:8000/docs
