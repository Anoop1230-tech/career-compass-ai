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
| 10 | Roadmap Generator and Career Explorer | Stage-wise roadmap that skips what you know; interactive career tree | ✅ |
| 11 | Exams, colleges and scholarships | Filterable lists with official source links and "last verified" dates | ✅ |
| 12 | AI Career Mentor | Chat assistant that uses your profile and roadmap as context | ✅ |
| 13 | ML evaluation | Compare ML models against the rule-based engine; keep ML only if it is genuinely better | ✅ |
| 14 | Hardening and final testing | Full test run, accessibility and performance checks, error handling review | ✅ |
| 15 | Deployment | PostgreSQL, production build, hosting, HTTPS | ✅ |
| 16 | Guided dashboard and UI redesign | Dashboard with "what to do next", grouped sidebar navigation, new warm design, smooth transitions | ✅ |
| 17 | Creative and skill-based careers | Professional courses (music, dance, design, writing, acting and comedy, film, culinary, fitness, beauty) and 21 careers that need no degree | ✅ |
| 18 | Themes and motion | Light, Dark, High contrast and Match device themes; home illustration with day and night scenes; scroll reveal and hover animations | ✅ |
| 19 | Security, learning links and feedback | Proxy-aware and per-account login limits, logout everywhere, change/reset password, course and certification links on roadmaps, "does this fit you?" feedback, smaller production image | ✅ |
| 20 | Language system | English and Hindi for every screen, language switcher, saved preference | ✅ |
| 21 | More careers | Healthcare, law, armed forces, agriculture and skilled trades (ITI) with stages, exams and routes | ✅ |
| 22 | Career comparison | Compare 2–3 careers: skills, education, years, exams, fit | ✅ |
| 23 | Project ideas | 2–3 project briefs per career with checklists in the roadmap | ✅ |
| 24 | Printable report | One-page summary (profile, matches, roadmap) saved as PDF from the browser | ✅ |
| 25 | Salary ranges | Sourced ranges by experience and city tier, never guessed | ✅ (official government pay only) |
| 26 | College predictor | Likely / borderline / unlikely colleges from published closing ranks | ✅ |
| 27 | Exam reminders | Follow exams, email reminders, calendar file, "coming up" on the dashboard | ✅ |
| 28 | Résumé upload | Read skills from a PDF résumé; user confirms before saving | ✅ |
| 29 | Hindi content | Careers, exams, skills and the mentor in Hindi (fallback to English) | ✅ (draft Hindi, needs native review) |
| 30 | Feedback-tuned weights | Propose scoring-weight changes from real "does this fit you?" answers | ✅ |

---

## Design rules (all phases)

Updated in Phase 16 (UI redesign). The old "neutral grey + top bar" rules are replaced by:

- Warm, calm palette that does not look like a typical "AI" product: sand neutrals (`#faf8f4` page, `#f3efe7` panels), ink-green primary (`#1f5c4a`) and a terracotta highlight (`#a94c22`). No purple, indigo, violet or neon, no gradients, no glow. Flat colour only (enforced by the "no gradients" browser test).
- Type: a classic serif for page and section headings, the system UI font for text. Both are already on the device, so nothing is downloaded.
- App shell: a fixed sidebar on screens 1024px and wider; a top bar with a slide-in drawer and backdrop on smaller screens. The menu is grouped in the order people use it: Your journey (Dashboard, Next Steps, For You, Roadmap), Explore (Careers, Career Tree, Can I become…?), Prepare (Assessments, Exams & Colleges, Mentor). `src/navigation.js` is the single list the sidebar, home page and dashboard all read.
- Guided flow: after saving a profile (or logging in with one) users land on the Dashboard, which shows their progress and one "Do this next" action.
- Motion: short, soft transitions (page slide-in, card lift, drawer slide, staggered list entrance, scroll reveal, hero cascade, illustration motion), all switched off when the user prefers reduced motion. Scroll reveal only hides blocks that start below the fold and removes its classes once shown, so content is never left hidden and contrast checks stay valid.
- Themes: every colour is a CSS variable; Light, Dark and High contrast themes are set with `data-theme` on `<html>` (Match device follows the system settings). New colours must be added as variables in all themes, and every theme must pass the axe scans in `e2e/themes.spec.js`.
- Visible focus outlines, keyboard accessible, WCAG 2.1 AA contrast (checked by axe-core), no sideways scrolling at any width.
- Every page loads fast: routes are lazy-loaded, icons are inline SVG, no UI or icon libraries.

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

---

## Phase 10 – Roadmap Generator and Career Explorer – ✅ done

- 10.1 Roadmap engine: study route (if a degree is still needed) → foundations → core skills → specialise → prove it (projects) → get in (exams, applications); skills you already have are skipped and listed
- 10.2 Progress: tick skills as learned (saved per user and career, private), time left updates; one "target career" per user that /roadmap opens automatically
- 10.3 API GET /api/roadmap, GET /api/roadmap/{career_id}, PUT /api/roadmap/{career_id}/target, PUT /api/roadmap/{career_id}/skills/{skill_id}
- 10.4 Career explorer: tree that expands on demand from any stage (study → careers → promotions and switches), keyboard accessible; API GET /api/explore, GET /api/explore/{kind}/{id}
- 10.5 Roadmap and Explorer pages (Explorer linked from Next Steps); instant tick feedback with rollback on error
- 10.6 Tests: 10 backend, 4 unit, 2 browser (found and fixed duplicate tree entries and a slow checkbox)

Result: 237 backend tests, 88 frontend unit tests, 84 browser tests passing; lint 0 warnings.

Known limits: roadmap items are skills from the datasets (no course links yet – courses.csv is still empty); ticking a skill does not change the profile skill level.

---

## Phase 11 – Exams, colleges and scholarships – ✅ done

- 11.1 New datasets with validator rules and database tables: 10 universities, 20 institutes (IITs, NITs, IIITs, IISc, IIMs, university departments), 11 scholarships (NSP, Central Sector Scheme, AICTE Pragati/Saksham/PG, INSPIRE-SHE, PMRF, UGC-NET JRF, PM Scholarship Scheme, Post Matric SC, Reliance Foundation UG)
- 11.2 Data honesty: every entry has an official https link and a last-checked date; scholarships are marked "not yet verified"; fees, NIRF ranks and amounts are left empty instead of guessed
- 11.3 Link checker run: 68 OK, 7 warnings (sites with incomplete certificate chains or that block automated checks), 0 dead links; the PM Scholarship link now points to the National Scholarship Portal where applications happen
- 11.4 API /api/resources/filters|exams|colleges|universities|scholarships with search, state, type, exam, programme and "only for my stage" filters
- 11.5 "Exams & Colleges" page with three tabs, filters kept in the URL
- 11.6 Fixed a crash found by the tests: switching tabs could briefly render old data with the new layout (fixed once in the shared data hook for every page)
- 11.7 Tests: 5 backend, 3 unit, 1 browser

Result: 242 backend tests, 90 frontend unit tests, 86 browser tests passing; lint 0 warnings; validator 0 errors.

Known limits: a starter list, not a full directory; courses and certifications datasets are still empty.

---

## Phase 12 – AI Career Mentor – ✅ done

- 12.1 Mentor engine that works fully offline: understands 13 kinds of question (next steps, which careers suit me, can I become X, skills, roadmap, exams, one exam, scholarships, colleges, compare two careers, salary, career info, greeting) and answers from the same engines as the rest of the app
- 12.2 Grounded and honest: answers cite data from the datasets and link to the page with details; never gives salary numbers or cut-offs; asks for a profile when it needs one
- 12.3 Conversation memory: follow-ups ("what skills should I learn?") use the last career discussed, or your roadmap target
- 12.4 Optional language model (any OpenAI-compatible API via LLM_API_URL / LLM_API_KEY / LLM_MODEL): only rephrases the grounded draft, never receives email or password, and falls back to the local answer on any error. Off by default
- 12.5 API GET /api/mentor/history, POST /api/mentor/chat, DELETE /api/mentor/history; login required, history private per user, 30 messages per minute limit, 500-character limit
- 12.6 Mentor page: chat with bullet formatting (rendered as text, no HTML), action links, suggestion chips, keeps your question if sending fails, clear conversation
- 12.7 Removed the old "coming soon" placeholder system: every menu item is now a real page
- 12.8 Tests: 23 backend (16 intent cases, privacy, rate limit, LLM success and failure), 5 unit, 1 browser

Result: 265 backend tests, 94 frontend unit tests, 88 browser tests passing; lint 0 warnings.

Known limits: the offline mentor matches keywords, so unusual phrasing may get the "I'm not sure" answer with suggestions; English only.

---

## Phase 13 – ML evaluation – ✅ done

- 13.1 Evaluation harness `python -m ml.evaluate` (backend): synthetic personas generated from each career's profile with random noise; 2,040 training personas, two test sets of 680 (held-out = same noise, shifted = more noise and misleading interest profiles)
- 13.2 Compared the rule engine with three scikit-learn models (logistic regression, random forest, k-nearest neighbours) on top-1 accuracy, top-3 accuracy and mean reciprocal rank
- 13.3 Decision rule fixed before running: ML replaces the rules only if it wins by 5+ points of top-3 accuracy on both test sets
- 13.4 Tests: 4 backend (deterministic personas, metrics, decision rule, end-to-end run)

| Model | Test set | Top-1 % | Top-3 % | MRR |
|---|---|---|---|---|
| rule_engine | held-out | 94.0 | 98.4 | 0.964 |
| rule_engine | shifted | 78.8 | 92.2 | 0.861 |
| logistic_regression | held-out | 95.7 | 99.9 | 0.977 |
| logistic_regression | shifted | 81.6 | 95.0 | 0.886 |
| random_forest | held-out | 97.8 | 99.9 | 0.988 |
| random_forest | shifted | 81.0 | 94.9 | 0.882 |
| k_nearest_neighbours | held-out | 71.8 | 86.6 | 0.802 |
| k_nearest_neighbours | shifted | 48.1 | 72.2 | 0.625 |

**Decision: keep the rule engine.** No model beat the rules by 5.0 points on every test set. The best model (logistic_regression) is slightly better than the rules (worst-case margin +1.5 points), which is too small to give up explainable scores that need no training data. The rule engine stays.

Caveat: labels are synthetic, not real career outcomes, so these numbers only show the engine ranks sensibly. Collecting real, consented feedback ("did this recommendation fit you?") is needed before any model could be trusted.

---

## Phase 14 – Hardening and final testing – ✅ done

- 14.1 Security headers on every response (strict Content-Security-Policy, no framing, no MIME sniffing, referrer and permissions policies, HSTS in production), `Cache-Control: no-store` on all API responses, 256 KB request size limit, gzip for large responses
- 14.2 Strict input: extra fields rejected on mentor and roadmap requests, true/false fields accept only true/false (found by the new robustness test)
- 14.3 Robustness test: 180 odd inputs (empty, SQL-injection-like, script tags, path traversal, emoji, long ids) across 18 endpoints – no server errors, always JSON
- 14.4 Accessibility: automated axe-core WCAG 2.1 A/AA scan of 23 pages (visitor and logged in) on desktop and mobile – 0 violations
- 14.5 Performance: API responses 10–35 ms (median, local), engine budget test (under 500 ms); initial JavaScript 106 kB gzipped, every other page loads on demand (1–4 kB each)
- 14.6 Home page: stage cards open the matching stage; all features listed
- 14.7 Full run: validator 0 errors; link check 68 OK, 7 warnings, 0 dead; npm audit 0 on both packages

Result: 276 backend tests, 94 frontend unit tests, 92 browser tests (incl. 4 accessibility scans) passing; lint 0 warnings.

---

## Phase 15 – Deployment – ✅ done

- 15.1 PostgreSQL support: `DATABASE_URL` normalises `postgres://` / `postgresql://` to the `psycopg` (v3) driver; `pool_pre_ping` reconnects cleanly after idle drops; SQLite stays the zero-setup default for development and tests
- 15.2 Alembic migrations (`backend/migrations/`, initial schema `0001`): production runs `alembic upgrade head` on startup; databases created before migrations existed are stamped first so tables are not built twice; tests still build tables straight from the models
- 15.3 Single-service production: the FastAPI backend also serves the built React app (`frontend/dist`) on one origin — no CORS, the login cookie works as-is, security headers cover the pages; `/assets/*` cached for a year, `/api/*` never shadowed, path-traversal blocked, everything else falls back to `index.html` for React Router
- 15.4 Production hardening via `ENVIRONMENT=production`: requires a real `SECRET_KEY` (refuses to start otherwise), sends HSTS, sets the session cookie `Secure` (HTTPS only)
- 15.5 Hosting: multi-stage `Dockerfile` (Node build → non-root Python runtime, reads `$PORT`), `docker-compose.yml` (app + PostgreSQL for a local production-like run), `render.yaml` blueprint (managed PostgreSQL + generated secret + automatic HTTPS); `.dockerignore` keeps secrets and dev state out of the image
- 15.6 HTTPS: managed platforms terminate TLS and redirect HTTP→HTTPS automatically; self-hosting uses a reverse proxy (Nginx/Caddy/load balancer). Documented in `docs/DEPLOYMENT.md` with a production checklist
- 15.7 Tests: 5 backend (migrate stamp+upgrade on a pre-existing DB, fresh upgrade, frontend serving of assets/SPA routes, API not shadowed, path-traversal blocked, missing build reported)

Result: 281 backend tests, 94 frontend unit tests, 92 browser tests passing; lint 0 warnings; production-mode smoke test verified (health "connected" via migrations, `/` serves the app, SPA routes fall back to index, `/api/*` still 404s correctly).

Known limits: HSTS/`Secure` cookies assume TLS is terminated by the platform or a reverse proxy in front of the app; the rate limiter and in-progress assessment answers are still per-server (Redis needed to run several servers); Docker image not built in CI here (Docker was unavailable in the dev environment), but the Compose and Render configs are validated as well-formed and the app runs in production mode directly.

---

## Phase 16 – Guided dashboard and UI redesign – ✅ done

- 16.1 Dashboard (`/dashboard`): greets the user by first name, shows progress through four steps (profile → assessment → career matches → roadmap) with a progress bar, and one highlighted "Do this next" action; shortcuts to every Explore and Prepare feature
- 16.2 Guidance after the profile: saving the profile opens the dashboard ("Profile saved. Here's what to do next."); logging in with a profile also opens it; the profile page links back to it
- 16.3 Navigation grouped into Your journey / Explore / Prepare, with icons, in a sidebar (desktop) or slide-in drawer with backdrop (mobile); Escape, backdrop tap or choosing a link closes it
- 16.4 New design system (full `index.css` rewrite): warm sand / ink-green / terracotta palette, serif headings, rounded cards with soft shadows, pill buttons, new home page (hero with journey preview, stage picker, how it works, features grouped like the menu, call-to-action band)
- 16.5 Smooth motion: page slide-in on every route, card lift on hover, staggered list entrance, drawer slide; all off with reduced motion
- 16.6 Fixes found by tests: answer choices could not be clicked after a hover effect covered the radio input (effect removed); logging out from the mobile menu on a protected page could land on the login page instead of home (fixed in the auth flow)
- 16.7 Tests: 8 new dashboard unit tests, nav-group and home-feature unit tests, logout unit test; browser tests updated for the new shell (width sweep at 8 widths, mobile drawer test, dashboard in the accessibility scan and route checks)

Result: 281 backend tests, 105 frontend unit tests, 95 browser tests (5 skipped by design: desktop-only or mobile-only) passing; lint 0 warnings; axe-core 0 violations including the dashboard; initial JavaScript 108 kB gzipped.

---

## Phase 17 – Creative and skill-based careers – ✅ done

For students who want a career built on talent and practice, and for those who are not continuing their studies.

- 17.1 New education level `course` (professional course, no degree needed) and 7 course stages: Music (singing, instruments, production); Dance and choreography; Design (graphic, fashion, interior, animation); Writing (poetry, lyrics, scripts, content); Acting, stand-up comedy and anchoring; Photography, film and video; Culinary, fitness and beauty
- 17.2 21 new careers with no degree requirement. Creative Arts: Singer, Music Composer and Producer, Sound Engineer, Dancer, Choreographer, Graphic Designer, Fashion Designer, Interior Designer, Animator and VFX Artist, Poet and Lyricist, Content and Script Writer, Actor, Stand-up Comedian, Anchor and Radio Jockey, Photographer, Video Editor, Filmmaker and Director, Content Creator. Vocational: Chef, Fitness Trainer and Yoga Instructor, Makeup Artist. Each has an O*NET source (Content Creator: YouTube Creators), RIASEC codes, 5–6 skills with levels and a mandatory core
- 17.3 34 new skills with everyday aliases ("shayari", "tabla", "stand-up", "Canva", "DaVinci Resolve", "yoga"…) so profile skills are recognised
- 17.4 Routes: every stage (school, diploma, bachelor's, master's, PhD and working – 22 stages) → each course → its careers (175 education paths); the validator now rejects any stage that does not offer all seven courses, so a future stage cannot leave anyone out; visitors who have not chosen a stage see all courses on Next Steps; 13 career progressions (for example Dancer → Choreographer, Graphic Designer → UI/UX Designer); 7 recorded switches (for example B.Tech → Stand-up Comedian, B.Tech → Content Creator, Teacher → Fitness Trainer). Course eligibility and honest limits (irregular early income, portfolio matters most) are stated; official links for NID, NSD, FTII and Skill India
- 17.5 Next Steps shows a separate "Professional courses" group and tab, so courses never mix with M.Tech or MBA; Dream Career Checker finds "B.Tech → Music course → Singer" as achievable with no degree blocker
- 17.6 Profile: new interests (Music & singing, Dance, Writing & poetry, Acting & comedy, Film/photography/video, Fashion & beauty, Cooking, Fitness & yoga) linked to the new areas; new stage "Not studying right now" (uses the last Class 12 stream or degree, otherwise Class 10); mentor understands "singer", "poet", "comedian", "youtuber", "chef" and more
- 17.7 Home page: "Careers beyond a degree" section with the seven areas and "Courses from my stage"; career pages show "No degree needed"
- 17.8 Fixes found on the way: "about 1 years" wording; the mentor no longer reports "designer" separately inside "fashion designer"

Result: validator 0 errors, 0 warnings (29 stages, 55 careers, 190 skills, 419 career-skill links, 240 education paths); link check 92 OK, 7 warnings (unchanged older sites), 0 dead; 291 backend tests, 107 frontend unit tests, 97 browser tests passing; lint 0 warnings.

Known limits: courses are described by type, not as a list of specific academies; salary is intentionally not shown; creative-career eligibility is general guidance marked "not yet verified".

---

## Phase 18 – Themes and motion – ✅ done

- 18.1 All hard-coded colours in `index.css` replaced by variables (on-accent text, soft status colours, dark band colours, overlay, shadows, illustration colours)
- 18.2 Themes: Light (warm paper), Dark (deep forest night, same green and terracotta accents), High contrast (black on white, 2px borders, underlined text links, strong focus ring) and Match device (follows the system dark mode and "more contrast" settings, and updates live)
- 18.3 Theme picker in the sidebar and mobile menu: a labelled group of four radio buttons (arrow keys work), saved in `localStorage` (`cc-theme`). `public/theme-init.js` applies the saved theme before the first paint (no white flash); it is a separate file because the CSP blocks inline scripts. Theme changes crossfade
- 18.4 Home illustration uses theme variables: day scene in Light, a night sky with a moon and twinkling stars in Dark
- 18.5 Animations: hero text cascade and underline, sign boards swing in, waving flag, drifting clouds, road lane moving, student pointing, scroll reveal of sections and cards (`hooks/useScrollReveal.js`), shine on primary buttons, sliding active-menu marker, icon tiles bounce, progress bars fill. All off with reduced motion
- 18.6 Tests: theme unit tests (saved value, Match device, picker); browser tests for axe scans of 8 pages in Dark and in High contrast, saving and restoring the theme, Match device, scroll reveal leaving nothing hidden, and reduced motion. An aptitude test now picks answers inside the page, not the theme radios in the menu

Result: lint 0 warnings; 112 frontend unit tests, 109 browser tests passing (5 skipped by design).


### Fix – suitable next steps for School Teacher (2026-09-30)

A BA → School Teacher route used to lead to Data Analyst and then to Data Engineer and Data Scientist, which does not suit most teachers. Changes:

- 4 new education careers (Education domain, O*NET sources): School Principal, Special Educator, School Counsellor, Instructional Designer; 8 new skills (lesson planning, classroom management, school administration, special education, counselling, child psychology, instructional design, e-learning tools); School Teacher gains lesson planning and classroom management
- From School Teacher: Principal (management, 8–15 years), Special Educator and School Counsellor (specialisation), Instructional Designer (lateral); switches to Content Writer, Content Creator (online teaching), Civil Services (UPSC) and Fitness Trainer. The Data Analyst switch was removed
- Entry paths from BA (and B.Com for Instructional Designer) with honest eligibility, e.g. RCI-recognised special education B.Ed, MA in counselling psychology
- Career Tree lists normal next roles before switches; the mentor recognises principal, counsellor, special educator and instructional designer

Result: validator 0 errors and 0 warnings (59 careers, 198 skills, 443 career-skill links, 244 education paths, 51 progressions, 27 switches); link check 97 OK, 0 failed; 293 backend, 112 frontend unit and 109 browser tests passing.



---

## Phase 19 – Security, learning links and feedback – ✅ done

- 19.1 Rate limits behind proxies: the client IP comes from `X-Forwarded-For` only for `TRUSTED_PROXY_HOPS` trusted proxies (Render: 1), so visitors no longer share one limit and cannot fake their IP. New per-account limit: 5 failed logins in 15 minutes pauses that account from any IP (same reply for unknown emails); a successful login or password reset clears it
- 19.2 Sessions: every token carries the user's `token_version`; logout, password change and reset increase it, so copied or old tokens stop working immediately on every device (migration `0002`)
- 19.3 Change password on the profile page (current password required, guesses count as failed logins; this device stays logged in). "Forgot password?": neutral reply for any email, one-time link valid 30 minutes, only a SHA-256 hash stored, link in the URL fragment so it never reaches server logs, 3 requests per email per hour; SMTP via `SMTP_*`, or printed in the log in development
- 19.4 Learning resources: `courses.csv` (92 courses, mostly free: CS50, MIT OCW, NPTEL, SWAYAM, Kaggle, freeCodeCamp, official docs…) and `certifications.csv` (24: AWS, Azure, Google Cloud, CKA, Security+, ISC2 CC, OSCP, PL-300, ISTQB, PMP, CFA, CA, CTET, RCI, FoSTaC…) with validator rules, tables (migration `0003`) and seeding. Each roadmap skill shows up to 2 courses (nearest level, free first); the "Get in" stage lists up to 3 certifications. No fees are stated; every entry links to the official page. `career_roadmaps.csv` stays header-only on purpose (roadmaps are generated)
- 19.5 "Does this fit you?" on every recommendation: yes / not for me + optional fixed reason (no free text), private per user, deleted with the account, saved with the score, rank and confidence shown (migration `0004`). `python -m ml.feedback` reports the share of "fits" per rank band – the real-data check Phase 13 asked for
- 19.6 Smaller production image: `requirements.txt` holds only the 34 runtime packages (81 MB instead of 450 MB); tests and pandas/scikit-learn/plotting are in `requirements-dev.txt`; tests, ML and e2e folders are excluded from the image. A clean runtime-only install ran migrations 0001–0003 and served the API in production mode
- 19.7 Mentor: the optional language-model call is async, so a slow provider no longer blocks a server worker (tested). Vitest uses `vmThreads` (about 13 s instead of 17 s)

Result: 352 backend tests, 121 frontend unit tests, 115 browser tests (5 skipped by design) passing; lint 0 warnings; validator 0 errors, 0 warnings; production build OK (initial JavaScript 112 kB gzipped). New course/certification links: 0 dead, 7 sites block automated checks (open in a browser to confirm).

Known limits: the Docker image was not built (Docker is not installed on the development machine); the rate limiter is still in memory per server (Redis needed for several servers); password reset needs SMTP configured in production; feedback numbers mean little until there are at least 30 answers.

## Phase 20 - Language system - ✅ done
- 20.1 Tiny translation system without a library (`frontend/src/i18n`): `en.js` and `hi.js` dictionaries, `useI18n()` with `t(key, vars)`, `tOr(key, fallback)` and `tOptions()`; fallback order Hindi → English → key. The choice is saved in `localStorage` (`cc-lang`) and sets `<html lang>`. Language picker (EN / हि) next to the theme picker. A unit test fails if `hi.js` misses a key or a `{placeholder}` that `en.js` has
- 20.2–20.5 Every screen translated: home, login/register, password reset, profile form and choice lists, dashboard, assessments, Next Steps, For You (including "does this fit you?"), skill gap, "Can I become…?", roadmap, career tree, careers list and detail, exams/colleges/scholarships, mentor, 404, the crash screen, loading and "verified" labels, and the home illustration's signposts
- 20.5 Server messages: errors carry a stable `code` (and `params`) next to the English `detail` (`backend/services/messages.py`, 30 codes plus pydantic validation types); the frontend shows the code in the chosen language and falls back to the server text for anything unknown. A backend test fails if a code has no frontend text
- 20.6 Hindi typography: Devanagari fonts first (Nirmala UI, Noto Sans Devanagari, Mangal), taller lines (body 1.75, headings 1.45) and no negative letter-spacing. Fixed a 2 px sideways scroll on For You at 320 px (grid column could not shrink). Browser tests in Hindi: axe scans on 23 pages, phone widths 320/360/412 px, line-height and clipping checks, switching language and keeping it after reload, a server error shown in Hindi

Result: 360 backend tests, 134 frontend unit tests, 124 browser tests (6 skipped by design) passing; lint 0 warnings; production build OK.

Known limits: the Hindi text is a first draft and needs review by a native speaker. Content that comes from the datasets (career names and descriptions, eligibility, reasons, mentor answers) is still English – that is Phase 29. An error already on screen keeps its language until the page reloads it.

## Phase 21 - More careers - ✅ done
- 21.1 Data: 20 careers in five new fields – Healthcare (doctor, specialist doctor, nurse, pharmacist, medical lab technologist), Law (advocate, corporate lawyer, civil judge, legal analyst), Defence (armed forces officer, Air Force pilot, Agniveer), Agriculture (agriculture officer, agricultural scientist, agri-business entrepreneur) and Skilled Trades (electrician, fitter/machinist, welder, motor vehicle mechanic, plumber)
- 21.2 8 new stages (MBBS, MD/MS, B.Sc Nursing, B.Pharm, 5-year and 3-year LLB, B.Sc Agriculture, ITI), 8 exams (NEET PG, GPAT, AILET, AIBE, NDA, CDS, AFCAT, Agniveer) with official links, 23 skills, 105 career–skill links, 169 education paths (each new stage also offers every professional course), 10 career moves and 3 switch plans. Every entry is marked "not yet verified" with eligibility worded as "check the current notice"; no fees, salaries or cut-offs
- 21.3 Engine: interests healthcare, law, agriculture and defence now point at their fields; "government career" also matches Defence and judges; "start a business" matches the agri-business career; the mentor recognises doctor, nurse, lawyer, judge, army, pilot, Agniveer, electrician, ITI, LLB and more
- 21.4 Careers page groups the 12 fields in a fixed order with one-line descriptions in English and Hindi

Result: validator 0 errors, 0 warnings; 366 backend tests, 134 frontend unit tests, 126 browser tests passing; lint 0 warnings; build OK.

Known limits: eligibility for nursing, pharmacy and agriculture admission varies by state and college, so it is summarised, not exact. Judicial service rules (practice years, age) differ by state. ITI-to-diploma lateral entry is left out because the only diploma stage is Computer Engineering.

## Phase 22 - Career comparison - ✅ done
- 22.1 `GET /api/compare?ids=A,B[,C]&stage=` (visitors too): per career the field, usual minimum education, shortest study route and its recorded years from the chosen stage (or the profile's stage), common starting stages, exams on the way in (including the step before, e.g. NEET UG for MBBS), core and helpful skills, work setting and next moves; with a profile also the match score and skill readiness. Skills all compared careers share are listed. 2–3 different careers required (code `compare.count`), unknown ids give 404
- 22.2 Compare page (`/compare`, in the Explore menu and as "Compare with others" on every career page): three pickers (a career can't be chosen twice), optional starting stage, a table with one column per career that turns into cards on phones, official exam links, skill-gap and roadmap buttons per career; everything is in the URL, so comparisons can be shared and survive reloads. English and Hindi
- 22.3 Tests: 7 backend, 3 unit, 1 browser flow; the page is in the accessibility scans (logged out and in) and the Hindi phone-width sweep

Result: 373 backend tests, 137 frontend unit tests, 128 browser tests passing; lint 0 warnings; build OK.

Known limits: study years add up recorded course lengths only (no exam preparation or job search time); careers reached only through work experience show "no direct route" from a study stage.

## Phase 23 - Project ideas - ✅ done
- 23.1 `datasets/project_ideas.csv`: 108 project briefs, each with a title, level, summary, skills it shows, a 3–8 step checklist, what you end up with and rough hours. Related careers share briefs, so every one of the 79 careers has 2–4 (the validator fails if any career has fewer than 2). Healthcare, law and defence briefs are supervised study, outreach or preparation work (case presentations, awareness camps, moot courts, fitness logs), never unsupervised practice
- 23.2 The roadmap's "Prove it" stage now lists up to 3 briefs (easiest first) instead of a generic "build 2–3 projects" line; its time comes from the briefs' hours at the roadmap's hours per week. Logged-in users tick checklist steps (`PUT /api/roadmap/{career}/projects/{project}/steps/{index}`), saved per career in `roadmap_progress.completed_project_steps` (migration `0005` also adds the `project_ideas` table); a "Projects finished" card shows progress
- 23.3 Tests: 5 backend (every career has 2–3 briefs on its roadmap, ordering, ticking and unticking, bad steps, visitors), 1 unit, 1 browser (tick, reload, still ticked)

Result: 378 backend tests, 138 frontend unit tests, 130 browser tests passing; validator 0 errors, 0 warnings; lint 0 warnings; build OK.

Known limits: project texts are English only until Phase 29. Ticking project steps does not change skill levels; skills are still updated in the profile or ticked separately.

## Phase 24 - Printable report - ✅ done
- 24.1 `GET /api/report` (login required) bundles the profile summary, latest test results, top 5 matches with the confidence level, the 3 most relevant next steps and the roadmap to the target career (or to the top match if no target is set) with skill and project progress. It reuses the existing engines; nothing new is estimated
- 24.2 "My Report" page (`/report`, in the Your journey menu): a print button opens the browser's print dialog, where "Save as PDF" keeps a copy – no PDF library or server rendering. Print styles hide the menu, footer and buttons, switch to black on white, avoid splitting sections and use A4-friendly margins; the page title becomes the suggested file name. English and Hindi
- 24.3 Tests: 4 backend, 3 unit, 1 browser (print media hides the app chrome; Chromium produces a real PDF); the page is in the accessibility and Hindi scans

Result: 382 backend tests, 141 frontend unit tests, 132 browser tests passing; lint 0 warnings; build OK.

Known limits: "one page" depends on how much the user has filled in; long reports flow onto a second page. Roadmap stage names and career texts from the server stay English until Phase 29.

## Phase 25 - Salary ranges - ✅ done (official government pay only)
- 25.1 Decision: only figures read from the text of an official government source are stored. `datasets/salary_ranges.csv` has 6 rows: IAS/IPS entry (Level 10, Rs 56,100 – Union Cabinet decision on the 7th CPC), Agniveer (Rs 30,000–40,000 a month, 70% in hand – PIB release on Agnipath) and Kendriya Vidyalaya PRT, TGT, PGT and Principal (Levels 6, 7, 8 and 12 with their full ranges – KV salary structure table). Each row says what is included (basic pay only; allowances extra), when the figures date from and when they were checked
- 25.2 Left out on purpose: armed forces officers, pilots and nurses (only coaching sites state their pay levels; the official PDFs could not be read without a PDF library) and all private-sector pay (no verified source). The "experience and city tier" split from the plan is not possible from official sources; city effects appear only as "House Rent Allowance depends on the city class"
- 25.3 Validator: `salary_ranges.csv` rows must link to a `.gov.in` or `.nic.in` site and have max ≥ min; a test proves an unofficial link is rejected. Table `salary_ranges` (migration `0006`); career detail API returns `salaries`
- 25.4 Career page "Official pay" section with the role, range in Indian digit grouping, what is included, the source link and dates; every other career says no official figures are recorded and why. English and Hindi
- 25.5 Tests: 5 backend, 1 browser

Result: validator 0 errors, 0 warnings; 387 backend tests, 141 frontend unit tests, 134 browser tests passing (one browser test failed once in the full run and passed on rerun; one unit test timed out once under load and passed on rerun); lint 0 warnings; build OK.

Known limits: the 8th Central Pay Commission has been set up with 1 January 2026 as the reference date but no new matrix is notified, so 7th CPC figures are shown with a note to check the latest notification. Adding more roles needs an official source per row.

## Phase 26 - College predictor - ✅ done
- 26.1 Data: `datasets/closing_ranks.csv` – 2,136 rows read from the official JoSAA opening/closing rank archive (2025, final round 6): B.Tech Computer Science, Electronics and Communication and Mechanical at 110 IITs, NITs, IIITs and other central institutes, for OPEN, EWS, OBC-NCL, SC and ST seats, gender-neutral and female-only pools, all-India (AI) and other-state (OS) quotas. Home-state quotas are left out because they depend on domicile. Validator checks the enums and that closing ≥ opening; table `closing_ranks` (migration `0007`)
- 26.2 `GET /api/predictor?exam=&rank=&seat_type=&female=&program=&include_unlikely=` (visitors too): JEE Advanced ranks are matched to IITs, JEE Main to the rest. Per programme the most generous pool the candidate can use is compared with the rank: likely ≤ 85% of last year's closing rank, borderline ≤ 110%, otherwise unlikely (hidden unless asked). Category seats use category ranks, as JoSAA publishes them
- 26.3 College Predictor page (`/college-predictor`, in the Prepare menu): exam, seat type, rank (label switches to "category rank"), programme, female-only seats, show unlikely; results table with last year's closing rank and a chance badge, the source year/round with an official link, and a plain-language disclaimer. Inputs live in the URL. English and Hindi
- 26.4 Tests: 7 backend (bands, top IIT rank, ordering, female pool, category rank, bad input), 2 unit, 1 browser; the page is in the accessibility and Hindi scans

Result: validator 0 errors, 0 warnings; 394 backend tests, 143 frontend unit tests, 136 browser tests passing; lint 0 warnings; build OK.

Known limits: one year and one round only; only three programmes; no state counselling, private colleges or home-state quota; the 85%/110% bands are simple rules, not a statistical model. Refreshing the data means re-reading the JoSAA archive for the new year.

## Phase 27 - Exam reminders - ✅ done
- 27.1 Data: `datasets/exam_dates.csv` holds exact dates only where the organiser has published them, each with its source. Today that is GATE 2027 (registration close 5 Oct, late close 12 Oct, admit card 4 Jan, exam 6–21 Feb, result 19 Mar), read from gate2027.iitm.ac.in/important_dates. The validator requires the source to be on the exam's own official site. CAT 2026's date was only found in news reports, so it is not included. Other exams use their usual month from `typical_month` and are labelled "not confirmed"
- 27.2 Follow exams: table `exam_follows` (migration `0008`, also `exam_dates`); `GET /api/reminders`, `PUT /api/reminders/{exam}` (`{email}`), `DELETE /api/reminders/{exam}`, `GET /api/reminders/calendar.ics` (all-day events, RFC 5545 line folding). Login required
- 27.3 Email job: `python -m services.reminders [--dry-run]`, run daily. It emails events starting within 14 days, only for exams with email on, and never sends the same event twice. Uses the existing SMTP settings; in development the email is written to the log
- 27.4 UI: Follow / Following buttons on exam cards (Exams & Colleges), and a "Coming up" section on the dashboard with dates, email on/off, unfollow and the calendar download. English and Hindi
- 27.5 Tests: 8 backend, 2 unit, 1 browser. The Phase 22 compare browser test now waits up to 15 s for the table, because it failed under full-suite load

Result: validator 0 errors; 402 backend tests, 145 frontend unit tests, 138 browser tests passing; lint 0 warnings; build OK.

Known limits: exact dates exist for GATE only; other exams show the usual month. The email job needs a scheduler (cron or Task Scheduler) in production.

## Phase 28 - Résumé upload - ✅ done
- 28.1 New runtime dependency: `pypdf==6.19.0` (pure Python, pinned in `backend/requirements.txt`). The file is sent as a raw `application/pdf` body, so no multipart library is needed
- 28.2 `POST /api/resume/skills` (login required): at most 2 MB (checked from Content-Length and again while reading; the global 256 KB request limit allows 2 MB for this path only), at most 10 pages, must start with `%PDF-`. Password-protected, broken and scanned (no text) PDFs return clear coded errors (`resume.*`). The file and its text are kept in memory for the request only, and nothing is saved
- 28.3 Matching (`engine/resume.py`): whole-word match of every catalog skill name and alias. Aliases of 1–2 characters (R, C) only match as an exact-case token. Catalog categories are mapped to the profile form's categories, and skills already in the profile are flagged
- 28.4 Page `/profile/resume` (button "Read skills from a résumé" on My Profile): choose a PDF, review the skills found, untick wrong ones, pick a level for each, then "Add N skills to my profile". Only then is the profile saved, through the normal `PUT /api/profile`. English and Hindi
- 28.5 Tests: 8 backend (with a hand-built text PDF), 2 unit, 1 browser (real PDF upload, then the profile is checked before and after confirming). The page is in the accessibility and Hindi scans

Result: 409 backend tests, 147 frontend unit tests, 140 browser tests passing; lint 0 warnings; build OK.

Known limits: only skills already in the catalog are found; scanned résumés need OCR, which is not included; levels default to Beginner for the user to adjust.

## Phase 29 - Hindi content - ✅ done (draft, needs native-speaker review)
- 29.1 Data: `datasets/translations_hi.csv` (213 rows, every row `status=draft`): Hindi names and descriptions for all 79 careers, the purpose of all 24 exams and the names of 31 education stages. The validator checks that each row points to a real entry and to a field that exists for its type. Table `translations` (migration `0009`), cached with the catalog
- 29.2 Language: the frontend sends `Accept-Language` with the chosen language (axios interceptor), and `useRequest` reloads when the language changes. `services/lang.py` picks `hi` or `en`; `Localizer` falls back to English field by field. Localised endpoints: catalog careers (list, search matches Hindi names too, detail), stages, exams, Resources exams, and recommendations
- 29.3 Mentor (`engine/mentor_hi.py`): Hindi questions are mapped onto the intents the router already understands (Hindi keywords, Hindi career names, a few everyday words such as वकील, डॉक्टर, नर्स; short words such as या only as whole words). Greeting, need-profile, fallback and career-info replies, career links and follow-up suggestions are in Hindi. The optional language-model rewrite is skipped for Hindi
- 29.4 Tests: 11 backend (language header, Hindi plus fallback in catalog, search, exams, stages, recommendations, mentor), 1 unit (request header), 1 browser (career page and search in Hindi)

Result: validator 0 errors; 420 backend tests, 148 frontend unit tests, 142 browser tests passing; lint 0 warnings; build OK.

Review needed: all Hindi catalog and mentor wording is a machine-written draft and must be checked by a native Hindi speaker before it is shown as final. Mark reviewed rows `status=reviewed`.

Known limits: skill names stay English (most are technical terms); eligibility text, roadmaps, project briefs, colleges and scholarships stay English; data-heavy mentor replies (next steps, roadmaps, exams, colleges, comparisons) still use English templates around Hindi or English names.

## Phase 30 - Feedback-tuned weights - ✅ done (report only)
- 30.1 `python -m ml.tune_weights [--json]`: for every "does this fit you?" answer, the six signal scores are recomputed from that user's current profile and tests (users without a profile are skipped). It measures how well the current `WEIGHTS` separate "fits" from "not for me" answers (pairwise AUC)
- 30.2 Bounded search: weight moves 2 points at a time between signals; the sum stays 100, each weight stays within ±50% of today's value and at least 4. A move is kept when AUC improves, or AUC is equal and the score gap between "fits" and "not for me" widens
- 30.3 Safeguards: no proposal below 30 answers, when all answers are of one kind, or when the AUC gain is under 0.02. The tool only prints a report; `engine/recommend.py` is never changed automatically. Adopting a proposal means editing `WEIGHTS` by hand, running the tests and `ml.evaluate`, and reviewing the change. No names or emails are read or printed
- 30.4 Tests: 5 backend (AUC, missing signals, search direction and bounds, not-enough-data, a 32-answer end-to-end run that leaves `WEIGHTS` unchanged)

Result: 425 backend tests passing. No frontend changes (148 unit and 142 browser tests from Phase 29 still apply).

Known limits: signals are recomputed from today's profile, which may differ from what the user saw when answering; AUC on a few dozen answers is noisy, which is why there is a minimum sample and a minimum gain. The dev database has 0 answers today, so no proposal exists yet.

## Extra - Exam syllabus button - ✅ done
- `datasets/exam_syllabus.csv` (migration `0010`): official syllabus link for 11 of the 24 exams, each fetched and checked on 2026-10-04 (JEE Main 2026 PDF, NEET UG 2026, CUET UG 2026, CUET PG 2026, NIMCET 2026, GATE 2027, UGC NET, GRE, TOEFL iBT, IELTS Academic, AIBE XXI). Section names are stored only where they were confirmed in that official text (JEE Main, GATE, UGC NET, GRE, TOEFL, IELTS)
- Every exam card on Exams & Colleges has a "Syllabus" button (`aria-expanded`) that opens the sections and the full official syllabus (page or PDF). For the 13 exams without a verified syllabus link (CAT, JEE Advanced, UPSC CSE, NDA, CDS, SSC CGL, IBPS PO, CLAT, AILET, NEET PG, GPAT, AFCAT, Agniveer) it says the syllabus is in the official notification and links to the official site. English and Hindi
- Tests: 1 backend, 1 unit, 1 browser. The Report unit test now waits for the page title (it failed twice under full-suite load)

Result: 426 backend, 149 unit, 144 browser tests passing; lint 0 warnings; build OK.

Known limits: syllabus links change every exam cycle and need re-checking; topic-level syllabus text is not copied into the site, only section names and the official link. Missing links can be added when the organisers publish them (UPSC's syllabus is inside each exam notice; SSC's and the armed forces' sites block automated reading).

## Extra - Clearer verification labels and first verified exams - ✅ done
- The badge "Not yet verified" was easy to misread as "this website is not official". It now reads "Details not re-checked this year" (hover: the link is the official website; confirm eligibility and dates there). Verified badges show their date on screen ("Verified on 2026-10-04")
- Checked against current official documents on 2026-10-04 and marked verified: JEE Main (2026 information bulletin: no age limit; Class 12 passed in 2024/2025 or appearing in 2026; two sessions), NEET UG (2026 bulletin: at least 17 by 31 December, no upper age limit; exam held 3 May 2026), GATE (2027 eligibility page: 3rd year or higher of any UG degree, or a completed approved degree)
- Exam dates confirmed on the official site, eligibility not re-checked (still unverified): CLAT 2027 on 6 December 2026, CUET UG 2026 from 11 May 2026
- Not yet checked: CAT (its site needs JavaScript), UPSC CSE and NDA (their notices are not reachable from upsconline/upsc.gov.in pages by script; news sites were not used as sources), and the remaining exams
