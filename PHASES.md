# Career Compass AI – Build Phases

Each phase ends with: working feature, automated tests passing, a git commit, and a short report.

Status key: ✅ done · 🔨 in progress · ⬜ not started

| # | Phase | What you get | Status |
|---|---|---|---|
| 1 | Project setup | FastAPI + React + SQLite running, health check, Git | ✅ |
| 2 | App shell and frontend–backend connection | Real website layout, navigation, design system, reliable API connection, one-command start, test setup (unit + browser) | ✅ |
| 3 | Accounts and user profile | Register, log in (secure passwords + tokens), multi-step profile form for any stage | ⬜ next |
| 4 | Career and education data | Starter tech-domain datasets filled, CSV validator, seed script loading them into the database, browse APIs | ⬜ |
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

1. Vite dev proxy: frontend calls `/api/...`, Vite forwards to FastAPI (no CORS or localhost/127.0.0.1 problems).
2. One command (`npm run dev` in project root) starts backend and frontend together.
3. Design system: colors, spacing, typography, buttons, cards as CSS variables.
4. Layout: header with navigation, mobile menu, footer with live backend status.
5. Pages: Home (landing), placeholders for upcoming features, 404 page.
6. Crash protection: error boundary, friendly API error messages with retry.
7. Speed: lazy-loaded routes.
8. Backend: JSON error responses for unknown routes and server errors.
9. Tests: backend (pytest), frontend unit (Vitest), browser end-to-end (Playwright, desktop + mobile).
10. Commit and report.
