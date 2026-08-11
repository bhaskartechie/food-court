"""
Alembic migration environment configuration.

Key fixes applied:
1. target_metadata now points to Base.metadata (was None — caused empty migrations)
2. sqlalchemy.url is overridden from DATABASE_URL environment variable
3. sys.path is adjusted so db package is importable during migration runs
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── Ensure the backend directory is on sys.path so 'db' package is importable ──
# This matters when running alembic from inside the container at /app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# ── Import Base with all models registered on it ──
from db.base import Base  # noqa: E402  (import after path manipulation)

# ── Alembic Config object ──
config = context.config

# ── Override sqlalchemy.url from DATABASE_URL environment variable ──
database_url = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/society_food",
)
config.set_main_option("sqlalchemy.url", database_url)

# ── Set up Python logging from alembic.ini ──
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Tell Alembic about our models so autogenerate works ──
target_metadata = Base.metadata


# ─────────────────────────────────────────────────────────────────────────────
# Migration runners
# ─────────────────────────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    Configures the context with just a URL (no live engine).
    SQL is emitted to stdout / script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    Creates an Engine and associates a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
