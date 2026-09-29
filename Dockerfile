# Career Compass AI — production image.
# One container runs the FastAPI backend, which also serves the built React app.

# ---------- Stage 1: build the frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app
# Install deps first (cached unless the lockfiles change)
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci && npm --prefix frontend ci
# Build the React app -> frontend/dist
COPY frontend ./frontend
RUN npm --prefix frontend run build

# ---------- Stage 2: runtime (Python backend + built frontend) ----------
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    ENVIRONMENT=production \
    SERVE_FRONTEND=true

WORKDIR /app

# Python dependencies (psycopg-binary ships its own libs, so no system build tools needed)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code and reference datasets
COPY backend ./backend
COPY datasets ./datasets

# Built frontend from stage 1 (services/frontend.py looks for ../frontend/dist relative to backend)
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Run as a non-root user
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

WORKDIR /app/backend
EXPOSE 8000

# Hosts set $PORT; default to 8000 locally. Migrations run automatically on startup.
CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
