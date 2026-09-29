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
