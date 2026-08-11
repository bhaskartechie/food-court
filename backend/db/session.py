"""
Database session management.
Provides SQLAlchemy engine, SessionLocal, and the get_db() FastAPI dependency.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Read DATABASE_URL from environment (set by docker-compose or .env)
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/society_food",
)

# Create synchronous engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Detect stale connections
    pool_size=10,
    max_overflow=20,
    echo=os.environ.get("DB_ECHO", "false").lower() == "true",
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is always closed after the request finishes.

    Usage:
        from db.session import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
