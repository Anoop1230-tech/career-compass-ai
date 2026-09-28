"""Database connection setup using SQLAlchemy 2.0."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread=False because FastAPI may use the
# connection across threads. PostgreSQL doesn't need it.
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

if is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _record):
        # SQLite ignores foreign keys (and ON DELETE CASCADE) unless told otherwise
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


# Each request gets its own session (a "conversation" with the DB)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """All database models (tables) inherit from this."""


def init_db() -> None:
    """Create any missing tables. (Phase 15 switches to Alembic migrations.)"""
    import models  # noqa: F401  (registers the tables on Base)
    import catalog.models  # noqa: F401  (reference data tables)

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: opens a session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
