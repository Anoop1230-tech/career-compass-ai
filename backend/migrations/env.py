"""Alembic environment: uses the app's own engine and models, so migrations
always target the same database as the app (DATABASE_URL)."""
from logging.config import fileConfig

from alembic import context

import catalog.models  # noqa: F401  (registers reference tables)
import models  # noqa: F401  (registers user tables)
from database import Base, engine

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=str(engine.url), target_metadata=target_metadata, literal_binds=True,
                      render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        # render_as_batch: lets SQLite handle ALTER TABLE changes in future migrations
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True,
                          compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()