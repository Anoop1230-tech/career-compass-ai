# Career Compass AI – Build Phases

Each phase ends with: working feature, automated tests passing, a git commit, and a short report.

Status key: ✅ done · 🔨 in progress · ⬜ not started

| # | Phase | What you get | Status |
|---|---|---|---|
| 1 | Project setup | FastAPI + React + SQLite running, health check, Git | ✅ |
| 2 | App shell and frontend–backend connection | Real website layout, navigation, design system, reliable API connection, one-command start, test setup (unit + browser) | ✅ |
| 3 | Accounts and user profile | Register, log in (secure passwords + tokens), multi-step profile form for any stage | ✅ |
| 4 | Career and education data | Starter tech-domain datasets filled, CSV validator, seed script loading them into the database, browse APIs | ✅ |
| 5 | Assessments | Interest (RIASEC), aptitude and personality tests with scoring saved to profile | ✅ |
| 6 | Next Step Engine | "Where am I → what can I do next?" paths with eligibility, time, exams, pros/cons | ✅ |
| 7 | Recommendation Engine | Weighted, explainable career scores with a "Why" section | ✅ |
| 8 | Skill Gap Analysis | Your skills vs target career skills, prioritized gaps | ✅ |
| 9 | Transition Engine and Dream Career Checker | "I am X, can I become Y?" analysis | ✅ |
| 10 | Roadmap Generator and Career Explorer | Stage-wise roadmap that skips what you know; interactive career tree | ⬜ next |
| 11 | Exams, colleges and scholarships | Filterable lists with official source links and "last verified" dates | ⬜ |
| 12 | AI Career Mentor | Chat assistant that uses your profile and roadmap as context | ⬜ |
| 13 | ML evaluation | Compare ML models against the rule-based engine; keep ML only if it is genuinely better | ⬜ |
| 14 | Hardening and final testing | Full test run, accessibility and performance checks, error handling review | ⬜ |
| 15 | Deployment | PostgreSQL, production build, hosting, HTTPS | ⬜ |

---

## Design rules (all phases)

- Neutral palette: white, grays, near-black text, one solid accent color. No gradients, no neon/purple "AI" styling, no glow effects.
- System font stack (no font download → faster first load).
- Clear top navigation, visible focus outlines, keyboard accessible, works on mobile.
- Subtle, short transitions only; disabled when the user prefers reduced motion.
- Every page loads fast: routes are lazy-loaded, no heavy UI libraries.

## Quality rules (all phases)

- Backend: pytest tests for every endpoint and engine.
- Frontend: Vitest + React Testing Library for components; Playwright browser tests for real user flows.
- No console errors in the browser tests.
- Nothing is marked done until all tests pass.

---

## Phase 2 – App shell and connection (tasks) – ✅ done

Result: 8 backend tests, 22 frontend unit tests, 31 browser tests (desktop + mobile) passing; lint 0 warnings; 0 npm vulnerabilities.

- 2.1 Vite dev proxy: frontend calls `/api/...`, Vite forwards to FastAPI (no CORS or localhost/127.0.0.1 problems).
- 2.2 One command (`npm run dev` in project root) starts backend and frontend together.
- 2.3 Design system: colors, spacing, typography, buttons, cards as CSS variables.
- 2.4 Layout: header with navigation, mobile menu, footer with live backend status.
- 2.5 Pages: Home (landing), placeholders for upcoming features, 404 page.
- 2.6 Crash protection: error boundary, friendly API error messages with retry.
- 2.7 Speed: lazy-loaded routes.
- 2.8 Backend: JSON error responses for unknown routes and server errors.
- 2.9 Tests: backend (pytest), frontend unit (Vitest), browser end-to-end (Playwright, desktop + mobile).
- 2.10 Commit and report.


---

## Phase 3 – Accounts and user profile – ✅ done

- 3.1 Password hashing (Argon2) and signed login tokens in an httpOnly cookie.
- 3.2 Register / log in / log out / "who am I" API, with brute-force rate limiting.
- 3.3 Profile API (create, read, update, delete) with strict validation; users can only access their own profile.
- 3.4 Six-step profile form that adapts to the user's stage (school vs college vs work).
- 3.5 Profile summary page, header login state, protected pages.
- 3.6 Tests on isolated databases and ports.

Result: 61 backend tests, 49 frontend unit tests, 47 browser tests (desktop + mobile) passing; lint 0 warnings; 0 npm vulnerabilities.

Known limits (planned for later phases): no password reset or email verification yet; the rate limiter is per server (needs Redis if we run several servers); tables are created automatically instead of via migrations (Alembic in Phase 15).

---

## Phase 4 – Career and education data – ✅ done

- 4.1 Fill education_stages.csv + skills.csv
- 4.2 Fill careers.csv + skill_career_mapping.csv
- 4.3 Fill entrance_exams.csv, education_paths.csv, career_paths.csv, career_transition_paths.csv
- 4.4 Dataset schema + validator (foreign keys, allowed values, duplicates, graph) + link checker
- 4.5 Database tables for reference data + seed script (safe to re-run, auto-seeds on start)
- 4.6 Browse APIs: stages, skills, careers (search/filter/detail), exams
- 4.7 Frontend: careers directory + career detail pages
- 4.8 Tests: validator, seed, APIs, frontend unit, browser
- 4.9 Verify links, full test run, docs, commit, report

Result: 22 stages, 156 skills, 34 careers, 296 career-skill links, 16 exams, 65 education paths, 34 career progressions, 18 career switches. 113 backend tests, 58 frontend unit tests, 60 browser tests passing; 40/41 official links OK (IBPS: certificate-chain warning only); lint 0 warnings; 0 npm vulnerabilities.

Known limits: exam eligibility is summarised and marked 'not verified' (users are sent to the official site); salary data is intentionally left empty; time estimates for career switches are general guidance; data covers mainly the technology domain plus a few commerce, government and education careers.

---

## Phase 5 – Assessments – ✅ done

- 5.1 Interest questions: 36 self-written RIASEC items (6 per type)
- 5.2 Personality questions: 20 IPIP Big-Five items (public domain) + 10 self-written work-style items, half reverse-keyed
- 5.3 Aptitude questions: 40 self-written items (8 per category), every answer checked by script
- 5.4 Question banks: validator rules, database tables, loaded with the other datasets
- 5.5 Scoring: 0-100 scores with low/moderate/high bands, Holland code, careless-answer warnings
- 5.6 API: start/resume, submit, results; aptitude answers never sent before submit, options shuffled per attempt
- 5.7 Website: assessments page, one-question-at-a-time test page with progress and resume, results page with review
- 5.8 Tests: unit and browser tests (found and fixed a bug where refreshing lost aptitude answers)
- 5.9 Final checks, docs, header layout fix

Result: 160 backend tests, 73 frontend unit tests, 70 browser tests passing; lint 0 warnings; 0 npm vulnerabilities.

Known limits: results are self-reflection, not validated psychometric scores; aptitude bank is small (40 items) so scores are rough; answers in progress are saved in the browser of the device used.

---

## Phase 6 – Next Step Engine – ✅ done

- 6.1 Engine foundation: cached catalog snapshot; profile → catalog stage mapping (degree/branch/stream/role, with a note when it is only a closest match); profile skills and project technologies → catalog skills
- 6.2 Next Step Engine: every recorded option from a stage (study further, careers, exams, switches) with eligibility, duration, exams with official links, pros/cons, verified flag and one concrete next action
- 6.3 Explainable ranking from goals, interests, skills and the interest test ("Fits you because …")
- 6.4 API GET /api/next-steps?stage= (works for visitors, personalised when logged in)
- 6.5 Next Steps page: stage picker, filter tabs, skill coverage bars, "back to my stage"
- 6.6 Tests: 36 backend (27 stage-mapping cases), 4 unit, 4 browser

Result: 196 backend tests, 76 frontend unit tests, 73 browser tests passing; lint 0 warnings.

Known limits: only stages in the datasets are covered (e.g. civil engineering maps to the closest core-engineering stage and says so); all eligibility entries are still "not yet verified".

---

## Phase 7 – Recommendation Engine – ✅ done

- 7.1 Six signals, each 0–100 with a fixed weight: interest test 22, skills 22, education path 18, aptitude 14, work style 10, interests/goals 14
- 7.2 Missing signals are left out and the rest re-weighted; a confidence % shows how much evidence was used, with links to what would improve it
- 7.3 Education reachability: follows study steps (e.g. Class 12 PCM → B.Tech → career) and known switch paths
- 7.4 Every score is explained: "why it fits", "keep in mind", per-signal breakdown, core skills to learn
- 7.5 API GET /api/recommendations?domain=&limit= and GET /api/recommendations/{career_id}
- 7.6 "For You" page with area filter and score details; header fixed so 7 menu items always fit (email moves to the mobile menu)
- 7.7 Tests: 11 backend (incl. sanity checks that data, commerce, public-service and design profiles get sensible top careers), 4 unit, 2 browser

Result: 207 backend tests, 80 frontend unit tests, 76 browser tests passing; lint 0 warnings.

Known limits: weights are expert-set, not learned (Phase 13 tests ML against them); only the 34 careers in the dataset are scored.

---

## Phase 8 – Skill Gap Analysis – ✅ done

- 8.1 Engine: every skill of the target career marked have / improve / learn, using the level you gave in your profile (project technologies count as beginner)
- 8.2 Priority = importance × 1.5 for core skills × levels still missing; core skills always first, foundations first on ties
- 8.3 Readiness %, core skills ready (x / y), rough learning time (3 / 5 / 8 weeks per level at ~8 h a week, clearly labelled as rough)
- 8.4 API GET /api/skill-gap/{career_id}
- 8.5 Skill gap page (career picker, top-match suggestions, tables that stack into cards on phones); "Check my skill gap" and "Get a roadmap" buttons on every career page
- 8.6 Tests: 6 backend, 3 unit, 1 browser

Result: 213 backend tests, 83 frontend unit tests, 78 browser tests passing; lint 0 warnings.

Known limits: skill levels are self-rated; time estimates are generic, not per skill.

---

## Phase 9 – Transition Engine and Dream Career Checker – ✅ done

- 9.1 Shortest study route from any stage to a career (breadth-first search over the education paths), with years and exams per step
- 9.2 Recorded switches (e.g. teacher → data analyst) and career progressions (e.g. software engineer → engineering manager)
- 9.3 One honest verdict: direct / achievable / hard / not directly from here, with reasons, blockers (degree level, entrance exams), typical time and your skill readiness
- 9.4 Closer alternatives in the same area when the dream is hard
- 9.5 API GET /api/transitions/check?to=&from_stage=&from_career= (visitors choose a start; logged-in users default to their profile)
- 9.6 "Can I become…?" page, linked from Next Steps
- 9.7 Tests: 14 backend (8 verdict cases), 3 unit, 1 browser

Result: 227 backend tests, 86 frontend unit tests, 80 browser tests passing; lint 0 warnings.

Known limits: routes only use the connections recorded in the datasets; "hard" means "no recorded route", not "impossible".