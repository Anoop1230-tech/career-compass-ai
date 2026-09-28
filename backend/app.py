"""FastAPI application entry point."""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from config import settings
from routes import health

logger = logging.getLogger("career_compass")

app = FastAPI(
    title=settings.APP_NAME,
    version="0.2.0",
    description="Personalized career guidance and roadmap API",
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


# ---------- Error handlers: every failure returns clean JSON ----------
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


@app.get("/")
def root():
    return {"message": "Career Compass AI API. See /docs for documentation."}
