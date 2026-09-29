"""Database connection setup using SQLAlchemy 2.0."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

def normalize_url(url: str) -> str:
    """Hosting providers often give "postgres://..." URLs; SQLAlchemy needs the
    driver name. psycopg (version 3) is the PostgreSQL driver we install."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = normalize_url(settings.DATABASE_URL)
is_sqlite = DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread=False because FastAPI may use the
# connection across threads. PostgreSQL doesn't need it.
connect_args = {"check_same_thread": False} if is_sqlite else {}

# pool_pre_ping: reconnect cleanly if the database server closed an idle connection
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=not is_sqlite)

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
    """Create any missing tables directly from the models. Used by the tests;
    the server uses migrate() (Alembic) so production schema changes are versioned."""
    import models  # noqa: F401  (registers the tables on Base)
    import catalog.models  # noqa: F401  (reference data tables)

    Base.metadata.create_all(bind=engine)


def migrate() -> str:
    """Bring the database schema up to date with Alembic migrations.

    Databases created before migrations existed (by create_all, same schema as
    migration 0001) are "stamped" first so their tables are not created twice.
    Returns what happened: "upgraded" or "stamped+upgraded"."""
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect

    here = Path(__file__).resolve().parent
    config = Config(str(here / "alembic.ini"))
    config.set_main_option("script_location", str(here / "migrations"))
    tables = set(inspect(engine).get_table_names())
    result = "upgraded"
    if tables and "alembic_version" not in tables:
        command.stamp(config, "0001")
        result = "stamped+upgraded"
    command.upgrade(config, "head")
    return result


def get_db():
    """FastAPI dependency: opens a session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
