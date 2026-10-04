# Career Compass AI

Personalized career guidance and roadmap platform: "Given my current education, skills, interests, experience and goals, what can I do next?"

Live: https://career-compass-fpgo.onrender.com (Render free plan: the first visit after 15 idle minutes takes about a minute to wake up). Privacy policy: [/privacy](https://career-compass-fpgo.onrender.com/privacy).

Features: profile and three self-assessments, explained career recommendations, skill gap, roadmaps with official course links, dream-career check, career tree, compare careers, printable report, career mentor chat, JoSAA college predictor, exam reminders (calendar file and email), résumé skill import, English and Hindi, sign in with Google.

- [WORKFLOW.md](WORKFLOW.md): architecture and user/data workflow
- [PHASES.md](PHASES.md): build plan and progress
- [docs/DATA_REQUIREMENTS.md](docs/DATA_REQUIREMENTS.md): dataset design
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production deployment (PostgreSQL, Docker, hosting, HTTPS)

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
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt   # runtime + tests + ML evaluation
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
- Login/register are rate limited (10 attempts per minute per IP by default; behind a proxy set `TRUSTED_PROXY_HOPS` so the real visitor IP is used). After 5 failed logins in 15 minutes an account is paused, from any IP.
- Logging out, changing or resetting the password signs the account out on every device (old tokens stop working at once).
- Sign in with Google (optional): server-side OpenID Connect code flow with PKCE, no Google script in the page. Shown only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; register `{APP_BASE_URL}/api/auth/google/callback` as the redirect URI of a "Web application" OAuth client in Google Cloud. Signing in with the email of an existing password account links it, signs out its other sessions and retires the old password.
- "Forgot password?" emails a one-time link valid for 30 minutes (only a hash is stored). Without `SMTP_HOST`, development prints the link in the server log.
- Tests use their own temporary databases; browser tests use ports 8001/5174, so your dev data and running servers are never touched.

## API endpoints

| Method | Path | Login | Purpose |
|---|---|---|---|
| GET | /api/health | no | Server and database status |
| POST | /api/auth/register | no | Create account (logs in) |
| POST | /api/auth/login | no | Log in |
| POST | /api/auth/logout | no | Log out (on every device) |
| GET | /api/auth/me | yes | Current user |
| GET | /api/auth/google/status | no | Whether "Continue with Google" is available |
| GET | /api/auth/google/login?next= | no | Redirect to Google's account chooser |
| GET | /api/auth/google/callback | no | Google returns here; logs in and redirects into the app |
| POST | /api/auth/change-password | yes | Change password (other devices are signed out) |
| POST | /api/auth/password-reset/request | no | Email a reset link (same answer for any email) |
| POST | /api/auth/password-reset/confirm | no | Set a new password with the emailed token |
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
| GET | /api/recommendations?domain=&limit= | yes | Ranked, explained career matches |
| GET | /api/recommendations/{career_id} | yes | Fit score and rank for one career |
| PUT / DELETE | /api/recommendations/{career_id}/feedback | yes | Save or remove "does this fit you?" (`fits` / `not_for_me` + optional reason) |
| GET | /api/recommendations/feedback | yes | Your own feedback answers |
| GET | /api/skill-gap/{career_id} | yes | Prioritised skill gap for a target career |
| GET | /api/transitions/check?to=&from_stage=&from_career= | optional | Dream career check: route, verdict, blockers |
| GET | /api/roadmap | yes | Roadmap for your target career |
| GET | /api/roadmap/{career_id} | optional | Stage-by-stage roadmap with course links per skill and certifications (personalised when logged in) |
| PUT | /api/roadmap/{career_id}/target | yes | Set your target career |
| PUT | /api/roadmap/{career_id}/skills/{skill_id} | yes | Mark a roadmap skill as learned or not |
| GET | /api/explore?stage= | optional | Career tree root |
| GET | /api/explore/{kind}/{id} | no | Children of a tree node |
| GET | /api/resources/exams, /colleges, /universities, /scholarships | optional | Filterable lists with official links (for_me=true uses your stage) |
| GET | /api/mentor/history | yes | Your mentor conversation |
| POST | /api/mentor/chat | yes | Ask the career mentor (30 per minute) |
| DELETE | /api/mentor/history | yes | Delete your conversation |
| GET | /api/next-steps?stage= | optional | Next steps from a stage (profile stage when logged in) |
| GET | /api/compare?ids=&stage= | optional | Compare 2 or 3 careers side by side |
| GET | /api/report | yes | Your full guidance report (printable) |
| GET | /api/predictor?exam=&rank=&seat_type=&female=&program= | no | College chances from last year's official JoSAA closing ranks |
| GET | /api/reminders | yes | Followed exams and upcoming official dates |
| GET | /api/reminders/calendar.ics | yes | The same dates as a calendar file |
| PUT / DELETE | /api/reminders/{exam_id} | yes | Follow or unfollow an exam |
| POST | /api/resume/skills | yes | Find skills in a résumé PDF (max 2 MB, not stored) |

`kind` is `interest`, `personality` or `aptitude`. Assessment results are for self-reflection and career guidance, not clinical or professional psychological assessments.

Send `Accept-Language: hi` to get catalog text, recommendations and mentor replies in Hindi (draft translations, falling back to English).

Full interactive docs: http://localhost:8000/docs

## Deployment

Production runs on Render from `main` (every push redeploys): one Docker web service (`Dockerfile`: builds the frontend, then serves it and the API from FastAPI) and a Render PostgreSQL database. On start the container runs migrations and loads the datasets. Environment variables: `ENVIRONMENT=production`, `SECRET_KEY`, `DATABASE_URL`, `APP_BASE_URL`, `TRUSTED_PROXY_HOPS=1`, optionally `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `SMTP_*` for emails. Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Free-plan limits: the database expires on 2 November 2026 unless upgraded (or moved, e.g. to Neon), and the exam reminder email job (`python -m services.reminders`) needs a paid cron job.
