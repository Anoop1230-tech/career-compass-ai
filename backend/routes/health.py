"""Health-check endpoint: proves the API and database are reachable."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    # Runs a trivial query; raises an error (HTTP 500) if the DB is unreachable
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "database": "connected",
    }
