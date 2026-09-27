"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import health

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Personalized career guidance and roadmap API",
)

# CORS: the browser blocks requests from localhost:5173 (React) to
# localhost:8000 (API) unless the API explicitly allows that origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # explicit list, never "*" with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# All routes live under /api so the frontend and API paths never collide
app.include_router(health.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Career Compass AI API. See /docs for documentation."}
