"""
FastAPI dependencies for dependency injection.

Usage in route files:
    from api.dependencies import get_db
    from sqlalchemy.orm import Session
    from fastapi import Depends

    @router.get("/items")
    def list_items(db: Session = Depends(get_db)):
        ...
"""

from db.session import get_db  # noqa: F401 — re-exported for routes to import

__all__ = ["get_db"]
