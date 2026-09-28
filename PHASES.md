# Career Compass AI – Build Phases

Each phase ends with: working feature, automated tests passing, a git commit, and a short report.

Status key: ✅ done · 🔨 in progress · ⬜ not started

| # | Phase | What you get | Status |
|---|---|---|---|
| 1 | Project setup | FastAPI + React + SQLite running, health check, Git | ✅ |
| 2 | App shell and frontend–backend connection | Real website layout, navigation, design system, reliable API connection, one-command start, test setup (unit + browser) | ✅ |
| 3 | Accounts and user profile | Register, log in (secure passwords + tokens), multi-step profile form for any stage | ✅ |
| 4 | Career and education data | Starter tech-domain datasets filled, CSV validator, seed script loading them into the database, browse APIs | ⬜ next |
| 5 | Assessments | Interest (RIASEC), aptitude and personality tests with scoring saved to profile | ⬜ |
| 6 | Next Step Engine | "Where am I → what can I do next?" paths with eligibility, time, exams, pros/cons | ⬜ |
| 7 | Recommendation Engine | Weighted, explainable career scores with a "Why" section | ⬜ |
| 8 | Skill Gap Analysis | Your skills vs target career skills, prioritized gaps | ⬜ |
| 9 | Transition Engine and Dream Career Checker | "I am X, can I become Y?" analysis | ⬜ |
| 10 | Roadmap Generator and Career Explorer | Stage-wise roadmap that skips what you know; interactive career tree | ⬜ |
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

## Phase 4 – Career and education data – 🔨 in progress

- 4.1 Fill education_stages.csv + skills.csv
- 4.2 Fill careers.csv + skill_career_mapping.csv
- 4.3 Fill entrance_exams.csv, education_paths.csv, career_paths.csv, career_transition_paths.csv
- 4.4 Dataset schema + validator (foreign keys, allowed values, duplicates, graph) + link checker
- 4.5 Database tables for reference data + seed script (safe to re-run, auto-seeds on start)
- 4.6 Browse APIs: stages, skills, careers (search/filter/detail), exams
- 4.7 Frontend: careers directory + career detail pages
- 4.8 Tests: validator, seed, APIs, frontend unit, browser
- 4.9 Verify links, full test run, docs, commit, report
