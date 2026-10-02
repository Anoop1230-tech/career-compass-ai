"""Alembic migrations create exactly the schema the models describe, on a
fresh database and on an old database created before migrations existed."""
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

import catalog.models  # noqa: F401
import models  # noqa: F401
from database import Base

BACKEND = Path(__file__).resolve().parents[1]


def run(db_path: Path, code: str) -> str:
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db_path.as_posix()}", "ENVIRONMENT": "development"}
    result = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stderr[-2000:]
    return result.stdout.strip()


def tables(db_path: Path) -> set[str]:
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_fresh_database_gets_every_table(tmp_path):
    db = tmp_path / "fresh.db"
    assert run(db, "from database import migrate; print(migrate())") == "upgraded"
    assert tables(db) == set(Base.metadata.tables) | {"alembic_version"}
    # Models and migrations agree (nothing left to autogenerate)
    run(db, "from alembic.config import main; main(argv=['check'])")
    # Running again is a no-op
    assert run(db, "from database import migrate; print(migrate())") == "upgraded"


def test_old_database_is_stamped_not_recreated(tmp_path):
    db = tmp_path / "old.db"
    # Databases from before Phase 15 were built by create_all with the 0001 schema:
    # reproduce that by applying 0001 and removing Alembic's bookkeeping table.
    run(db, "from alembic.config import main; main(argv=['upgrade', '0001'])")
    run(db, "from database import engine; from sqlalchemy import text\n"
            "with engine.begin() as c: c.execute(text('DROP TABLE alembic_version'))")
    assert "alembic_version" not in tables(db)
    assert run(db, "from database import migrate; print(migrate())") == "stamped+upgraded"
    assert tables(db) == set(Base.metadata.tables) | {"alembic_version"}
    run(db, "from alembic.config import main; main(argv=['check'])")
