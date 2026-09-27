# Career Compass AI – Workflow

Personalized Career Guidance & Roadmap. A career navigation system that answers:
"Given my current education, skills, interests, experience and goals, what can I do next?"

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND  (React + Vite, http://localhost:5173)         │
│  Pages → Components → services/api.js (Axios)            │
└───────────────────────────┬──────────────────────────────┘
                            │  HTTP/JSON (REST: /api/...)
┌───────────────────────────▼──────────────────────────────┐
│  BACKEND  (FastAPI + Uvicorn, http://localhost:8000)     │
│  routes/    → HTTP endpoints (validate + call services)  │
│  schemas.py → Pydantic request/response models           │
│  services/  → business logic / engines                   │
│  models.py  → SQLAlchemy tables                          │
│  ml/        → training & evaluation scripts              │
└───────────────────────────┬──────────────────────────────┘
                            │  SQLAlchemy ORM
┌───────────────────────────▼──────────────────────────────┐
│  DATABASE  SQLite (dev) → PostgreSQL (production)        │
│  Seeded from datasets/*.csv                              │
└──────────────────────────────────────────────────────────┘
```

---

## 2. User Workflow

```
[1] Sign up / Log in
        │
        ▼
[2] Select current stage
    (Class 10, Class 11-12, Diploma, UG, Graduate, Master's, PhD,
     Fresh graduate, Working professional, Experienced, Career changer,
     Job seeker, Entrepreneur, Other)
        │
        ▼
[3] Build profile
    Basic → Education → Skills → Experience → Interests → Goals
        │
        ▼
[4] Assessments
    Interest test → Aptitude test → Personality test
        │
        ▼
[5] Choose what to do
    ├── "What can I do next?"          → Next Step Engine
    ├── "Recommend careers for me"     → Recommendation Engine
    ├── "Can I become Y?"              → Transition Engine / Dream Career Checker
    ├── "Explore paths"                → Career Path Explorer (graph)
    └── "Ask a question"               → AI Career Mentor
        │
        ▼
[6] Results (explainable)
    Paths + Why + Eligibility + Skill gaps + Exams + Courses + Certifications
        │
        ▼
[7] Pick a target → Skill Gap Analysis → Personalized Roadmap
        │
        ▼
[8] Supporting modules
    Colleges / Universities • Entrance Exams • Scholarships
        │
        ▼
[9] Track progress → update profile → roadmap re-adapts
```

---

## 3. Data Workflow (inside the backend)

```
User profile + assessment scores
        │
        ▼
CURRENT STATE  (e.g. "B.Tech CSE, 3rd year")
        │
        ▼
NEXT STEP ENGINE
  Looks up the career graph: current_state → possible next_states
  (education_paths.csv, career_paths.csv, career_transition_paths.csv)
        │
        ▼
FILTER by eligibility (education, exams, experience)
        │
        ▼
RECOMMENDATION ENGINE – weighted, explainable score per path
  Compatibility = w1·Education + w2·Skills + w3·Interests
                + w4·Aptitude  + w5·Experience + w6·Goals
  (each component normalized to 0–1, weights sum to 1)
        │
        ▼
SKILL GAP ANALYSIS
  target_skills (skill_career_mapping.csv) − user_skills = missing skills
        │
        ▼
ROADMAP GENERATOR
  Ordered stages from career_roadmaps.csv, skipping skills already known,
  attaching courses.csv / certifications.csv / entrance_exams.csv
        │
        ▼
RESPONSE → paths, reasons, gaps, roadmap, next immediate action
```

Rules:
- Recommendations are guidance, never guaranteed outcomes.
- Every recommendation shows "Why" (which factors scored high).
- Eligibility, exams, scholarships and college data come from official/verified sources,
  marked as "verified" vs "general guidance" with a source URL and last-checked date.

---

## 4. Core Modules

| Module | Input | Output |
|---|---|---|
| User Profile | Form data | Stored profile |
| Assessments | Question answers | Interest / aptitude / personality scores |
| Next Step Engine | Current state + goal | Paths with eligibility, time, exams, roles, pros/cons, next action |
| Recommendation Engine | Full profile | Ranked, explained career paths |
| Career Path Explorer | Education/career node | Tree/graph of options |
| Career Transition Engine | Current X, target Y | Strengths, missing skills/qualifications, transition paths, stages |
| Dream Career Checker | Current education + dream career | Eligibility, required education/skills, roadmap, alternatives |
| Skill Gap Analysis | User skills + target career | Missing skills (prioritized) |
| Roadmap Generator | Target + skill gaps | Stage-wise adaptive roadmap |
| Higher Education Guidance | Current degree | Options (M.Tech, MS, MBA, PhD…) with requirements |
| Exam Guidance | Profile + target | Relevant exams (JEE, NEET, CUET, GATE, CAT, CLAT, UPSC, SSC…) |
| College Finder | Filters | Colleges/universities list |
| Scholarship Finder | Profile | Eligible scholarships (official sources) |
| AI Career Mentor | Question + profile + roadmap | Contextual answer |

---

## 5. Datasets (datasets/)

| File | Purpose |
|---|---|
| careers.csv | Career definitions (id, name, domain, description, min education) |
| career_paths.csv | Career → career progression edges |
| education_paths.csv | Education stage → next education/career edges |
| skills.csv | Skill master list |
| skill_career_mapping.csv | Skills required per career (with importance level) |
| courses.csv | Learning resources per skill |
| certifications.csv | Certifications per career/skill |
| colleges.csv / universities.csv | Institution data |
| entrance_exams.csv | Exams, eligibility, source URL, last verified date |
| scholarships.csv | Scholarships, eligibility, official source URL |
| career_roadmaps.csv | Ordered roadmap stages per career |
| career_transition_paths.csv | From → to transitions with requirements |
| aptitude_questions.csv / interest_questions.csv / personality_questions.csv | Assessment question banks |

Each dataset gets a field-level data dictionary in `docs/`.

---

## 6. Development Workflow (phases)

Build one phase at a time. Test each phase before moving to the next.

| Phase | Work | Done when |
|---|---|---|
| 1 | Project setup: venv, FastAPI, React/Vite, SQLite, Git, health check | Frontend shows "Backend: ok, Database: connected"; `pytest` passes |
| 2 | User profile + auth: models, schemas, CRUD APIs, profile forms | User can register, log in, create/edit profile |
| 3 | Career/education database: CSV design, seed script | Tables populated from datasets/ |
| 4 | Interest / aptitude / personality assessments | Scores saved to profile |
| 5 | Next Step Engine | Returns valid next paths for any stage |
| 6 | Recommendation Engine (rule-based, weighted) | Ranked paths with "Why" |
| 7 | Skill Gap Analysis | Missing skills listed for a target |
| 8 | Career Transition Engine + Dream Career Checker | X → Y analysis works |
| 9 | Roadmap Generator | Adaptive stage-wise roadmap |
| 10 | College / Exam / Scholarship modules | Filterable, source-linked results |
| 11 | AI Career Mentor | Chat answers using profile + roadmap context |
| 12 | ML improvements (Decision Tree, Random Forest, LogReg, KNN, Clustering) | ML beats rule-based baseline on validation metrics, else keep rules |
| 13 | Testing: unit, API, frontend, user testing | Test suite passes |
| 14 | Deployment | App live with PostgreSQL, env-based config, HTTPS |

Per-feature loop:
```
Concept → Why needed → Create files → Write code → Run → Check expected output
→ Fix errors → Write/Run tests → git commit → next feature
```

---

## 7. Folder Structure

```
Career Compass AI/
├── backend/
│   ├── venv/                  (not committed)
│   ├── routes/                (HTTP endpoints)
│   ├── services/              (engines)
│   ├── ml/                    (ML experiments)
│   ├── tests/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── recommendation.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── .env                   (not committed)
│   └── .env.example
├── frontend/
│   ├── src/ (components, pages, services, context, hooks)
│   ├── public/
│   ├── .env                   (not committed)
│   └── package.json
├── datasets/
├── models/
├── docs/
├── screenshots/
├── .gitignore
├── README.md
└── WORKFLOW.md
```

---

## 8. Git Workflow

```
main            → always working code
feature/<name>  → one branch per phase/feature (e.g. feature/user-profile)
```

```powershell
git checkout -b feature/user-profile
# ...build + test...
git add <specific files>
git commit -m "Phase 2: user profile model and API"
git checkout main
git merge feature/user-profile
git push
```

Never commit: `venv/`, `node_modules/`, `.env`, `*.db`, trained model files.

---

## 9. Data Reliability Rules

- Prefer official sources and public datasets/APIs.
- Store `source_url` and `last_verified` for time-sensitive data (eligibility, exams, scholarships, colleges).
- Do not fabricate eligibility rules; show "unverified – check official site" when unsure.
- Do not scrape sites that forbid it, and do not bypass authentication, robots.txt or terms of service.
- Salaries and outcomes are shown as indicative ranges, never guarantees.
