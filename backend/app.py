"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from config import settings
from catalog.seed import auto_seed
from database import SessionLocal, init_db
from services.security import SecurityHeadersMiddleware
from routes import (
    assessments, auth, catalog, explore, health, mentor, next_steps, profile, recommendations, resources, roadmap,
    skill_gap, transitions,
)

logger = logging.getLogger("career_compass")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()  # create tables on startup
    if settings.AUTO_SEED:
        with SessionLocal() as db:
            auto_seed(db)  # load reference data from datasets/ if it changed
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Personalized career guidance and roadmap API",
    lifespan=lifespan,
)

# CORS: only needed when the frontend runs on a different origin than the API.
# In development the Vite proxy makes them the same origin, so this is a fallback.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # explicit list, never "*" with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)
# Compress larger JSON responses (catalog lists, roadmaps)
app.add_middleware(GZipMiddleware, minimum_size=1024)
# Security headers on every response; HSTS only when served over HTTPS in production
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)


# ---------- Error handlers: every failure returns clean JSON ----------
def _field_name(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) or "request"


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """422 with one readable sentence (`detail`) plus per-field errors for forms."""
    errors = [
        {"field": _field_name(err.get("loc", ())), "message": err.get("msg", "Invalid value").removeprefix("Value error, ")}
        for err in exc.errors()
    ]
    first = errors[0] if errors else {"field": "request", "message": "Invalid request"}
    return JSONResponse(
        status_code=422,
        content={"detail": f"{first['field']}: {first['message']}", "errors": errors},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s", request.url.path)
    return JSONResponse(
        status_code=503,
        content={"detail": "The database is unavailable. Please try again shortly."},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    # Log the real error for developers, but never leak internals to users
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server."},
    )


# All routes live under /api so the frontend and API paths never collide
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(next_steps.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(skill_gap.router, prefix="/api")
app.include_router(transitions.router, prefix="/api")
app.include_router(roadmap.router, prefix="/api")
app.include_router(explore.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(mentor.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Career Compass AI API. See /docs for documentation."}
