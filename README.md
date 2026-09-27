# Career Compass AI

Personalized career guidance and roadmap platform: "Given my current education, skills, interests, experience and goals, what can I do next?"

See [WORKFLOW.md](WORKFLOW.md) for architecture and phases, and [docs/DATA_REQUIREMENTS.md](docs/DATA_REQUIREMENTS.md) for the dataset design.

## Tech stack

- Frontend: React, Vite, React Router, Axios
- Backend: Python, FastAPI, Uvicorn, SQLAlchemy
- Database: SQLite (dev), PostgreSQL (production)
- Data/ML: Pandas, NumPy, scikit-learn, Matplotlib, Seaborn

## Run locally (Windows PowerShell)

Backend (terminal 1):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
pytest -v
uvicorn app:app --reload
```

Frontend (terminal 2):

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5173 — it should show "Backend: ok, Database: connected".
API docs: http://localhost:8000/docs

## Status

- [x] Phase 1: project setup
- [ ] Phase 2: user profile and auth
