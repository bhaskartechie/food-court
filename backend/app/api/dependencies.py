"""
FastAPI dependencies used across all route handlers.

This is the canonical place to import get_db, get_current_user, and role guards.
Keeping these here (rather than in app.core.security) avoids circular imports,
since these functions depend on app.db.session and app.db.models.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import User
from app.db.session import get_db

# Re-export get_db so routes only need to import from here
__all__ = ["get_current_user", "get_db", "require_role"]

bearer_scheme = HTTPBearer(auto_error=False)

DB_DEPENDENCY = Depends(get_db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = DB_DEPENDENCY,
) -> User:
    """
    FastAPI dependency — decodes the Bearer JWT and returns the authenticated User.

    Raises HTTP 401 if:
      - No Authorization header provided
      - Token is invalid or expired
      - User is not found or is inactive
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = (
        db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(*roles: str):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.post("/admin/approve")
        def approve(user: User = Depends(require_role("admin"))):
            ...

        @router.post("/menu")
        def add_menu(user: User = Depends(require_role("seller", "admin"))):
            ...
    """

    def role_guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(roles)}",
            )
        return current_user

    # Give the inner function a unique name to help FastAPI's dependency cache
    role_guard.__name__ = f"require_{'_or_'.join(roles)}"
    return role_guard
