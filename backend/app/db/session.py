"""
Database session management.

Creates the SQLAlchemy engine and session factory from settings,
and exposes the get_db() FastAPI dependency for per-request sessions.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Detect and recycle stale connections
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=settings.DB_ECHO,
)

# ── Session Factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ── FastAPI Dependency ────────────────────────────────────────────────────────


def get_db():
    """
    Yield a database session for the duration of a single request.
    The session is always closed in the finally block, even on errors.

    Usage in route:
        from app.db.session import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
