# Deployment (Phase 15)

Career Compass AI ships as **one service**: the FastAPI backend also serves the
built React app, so the whole product runs on a single origin over HTTPS. This
means no CORS in production, the login cookie works as-is, and the security
headers cover the pages too.

## What "production mode" changes

Set `ENVIRONMENT=production`. That one switch:

- **Serves the frontend** (`frontend/dist`) from the backend (`SERVE_FRONTEND` defaults on).
- **Runs database migrations** with Alembic on startup instead of `create_all`.
- **Requires a real `SECRET_KEY`** — the app refuses to start with a missing or `change-me` key.
- **Sends HSTS** (`Strict-Transport-Security`) and sets the login cookie `Secure` (HTTPS only).

## 1. Database: PostgreSQL

Development uses SQLite; production uses PostgreSQL.

```
DATABASE_URL=postgresql+psycopg://user:password@host:5432/career_compass
```

`postgres://` and `postgresql://` URLs (what most hosts hand out) are accepted
and normalized to the `psycopg` (v3) driver automatically. Connections use
`pool_pre_ping` so a dropped idle connection reconnects cleanly.

### Migrations

Migrations live in `backend/migrations/`. They run automatically on startup in
production, or manually from `backend/`:

```bash
alembic upgrade head                      # apply all migrations
alembic revision --autogenerate -m "..."  # create one after changing models
```

A database created before migrations existed (same schema as migration `0001`)
is "stamped" first so its tables are not created twice.

## 2. Production build

The frontend is built with `npm --prefix frontend run build`, producing
`frontend/dist`. In the Docker image this happens in a Node build stage; the
built files are copied next to the backend, which serves them:

- `/assets/*` — hashed files, cached for a year (`immutable`).
- `/api/*` — always the API, never a file.
- anything else — the matching file if it exists, otherwise `index.html` so
  React Router can render the page (path-traversal `../` tricks are blocked).

## 3. Hosting

### Option A — Docker (any host)

```bash
docker build -t career-compass .
docker run -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e DATABASE_URL="postgresql+psycopg://user:pass@host:5432/career_compass" \
  -e SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" \
  career-compass
```

The image runs as a non-root user and reads `$PORT` (defaults to 8000), so it
works on hosts that assign a port (Cloud Run, Railway, Fly.io, Render, ECS, …).

### Option B — Local production-like stack (Docker Compose)

Brings up the app plus a PostgreSQL container:

```bash
docker compose up --build     # then open http://localhost:8000
```

### Option C — Render blueprint (managed DB + automatic HTTPS)

`render.yaml` provisions a managed PostgreSQL database, injects `DATABASE_URL`,
generates a secret `SECRET_KEY`, and deploys the Docker image. Point Render at
the repo and it reads the blueprint. `/api/health` is the health check.

## 4. HTTPS

Serve the app only over HTTPS in production:

- **Managed platforms** (Render, Railway, Fly.io, Cloud Run, App Runner)
  terminate TLS and redirect HTTP→HTTPS for you. Nothing to configure.
- **Self-hosted**: put a reverse proxy (Nginx, Caddy, or a load balancer) in
  front to terminate TLS and forward to the container on port 8000. Caddy issues
  and renews Let's Encrypt certificates automatically.

Once traffic is HTTPS, the app's production settings do the rest: HSTS tells
browsers to stay on HTTPS, and the `Secure` cookie flag stops the session cookie
from ever being sent over plain HTTP.

## Production checklist

- [ ] `ENVIRONMENT=production`
- [ ] `DATABASE_URL` points at PostgreSQL
- [ ] `SECRET_KEY` is a fresh long random value (not `change-me`)
- [ ] Served over HTTPS (managed platform or reverse proxy)
- [ ] `/api/health` returns `{"status": "ok"}` and reports the database connected
