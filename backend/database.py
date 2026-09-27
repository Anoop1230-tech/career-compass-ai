"""Database connection setup using SQLAlchemy 2.0."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

# SQLite needs this flag because FastAPI may use the connection across threads.
# PostgreSQL doesn't need it, so we only add it for SQLite.
connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# Each request gets its own session (a "conversation" with the DB)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    """All database models (tables) will inherit from this in Phase 2."""


def get_db():
    """FastAPI dependency: opens a session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
