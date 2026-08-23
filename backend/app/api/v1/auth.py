"""
Authentication routes — JWT password-based login.

Flow:
  POST /api/v1/auth/register       → create account with email + password
  POST /api/v1/auth/login          → return JWT access + refresh tokens
  POST /api/v1/auth/refresh        → exchange refresh token → new access token
  GET  /api/v1/auth/me             → return current user (requires Bearer token)
  POST /api/v1/auth/logout         → stateless (client deletes token)

Future OTP routes (/api/v1/auth/otp/*):
  Stub endpoints return 501 to signal "coming soon" to API consumers.
"""

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.db.models import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
    UserInfo,
)
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

DB_DEPENDENCY = Depends(get_db)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = DB_DEPENDENCY):
    """
    Register a new user account with email and password.

    - Hashes the password with bcrypt before storing
    - Returns 409 if the email is already registered
    - Account starts with 'pending' verification_status
    """
    user = auth_service.register_user(
        db,
        email=str(request.email),
        name=request.name,
        password=request.password,
        role=request.role,
    )
    logger.info("New user registered: %s (role=%s)", user.email, user.role)
    return {
        "message": "Account created successfully.",
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "verification_status": user.verification_status,
    }


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = DB_DEPENDENCY):
    """
    Authenticate with email + password and return JWT tokens.

    Returns:
      - access_token:  short-lived (default 30 min)
      - refresh_token: long-lived (default 7 days)
    """
    user = auth_service.authenticate_user(db, str(request.email), request.password)

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id, user.role)

    logger.info("User logged in: %s (role=%s)", user.email, user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserInfo(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            flat_number=user.flat_number,
            verification_status=user.verification_status,
            is_verified=user.is_verified,
        ),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(request: RefreshRequest, db: Session = DB_DEPENDENCY):
    """Exchange a valid refresh token for a new access token."""
    payload = decode_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Provide a refresh token.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = auth_service.get_user_by_id(db, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated.",
        )

    new_access_token = create_access_token(user.id, user.role)
    return RefreshResponse(access_token=new_access_token, token_type="bearer")


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "flat_number": current_user.flat_number,
        "phone": current_user.phone,
        "verification_status": current_user.verification_status,
        "is_verified": current_user.is_verified,
        "is_active": current_user.is_active,
    }


@router.post("/logout")
async def logout():
    """Logout — client must delete the token. (Stateless JWT — no server-side invalidation.)"""
    return {
        "message": "Logged out successfully. Please delete the token on the client side."
    }


@router.patch("/me/password")
async def change_password(
    current_password: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True, min_length=8),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change the authenticated user's password.

    Verifies the current password before updating to the new one.
    Raises 400 if the current password is incorrect.
    """
    from app.core.security import hash_password, verify_password

    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = hash_password(new_password)
    db.commit()
    logger.info("Password changed for user: %s", current_user.email)
    return {"message": "Password changed successfully."}


# ── Future OTP Routes (not yet implemented) ────────────────────────────────────


@router.post("/otp/request", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def request_otp():
    """Request an OTP via email or phone. (Coming soon — not yet implemented.)"""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OTP authentication is coming soon. Please use email + password for now.",
    )


@router.post("/otp/verify", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def verify_otp_route():
    """Verify OTP and log in. (Coming soon — not yet implemented.)"""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OTP authentication is coming soon. Please use email + password for now.",
    )
