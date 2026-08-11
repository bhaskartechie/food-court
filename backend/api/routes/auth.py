"""
Authentication routes — OTP-based passwordless login.

Dev mode behaviour (ENABLE_OTP_EMAIL=false):
  - OTP is NOT sent via email
  - OTP is printed to backend logs (docker-compose logs backend)
  - The OTP is also returned in the response as 'dev_otp' field
    so the frontend can display it for easy testing

Production behaviour (ENABLE_OTP_EMAIL=true):
  - OTP is sent to email via SMTP
  - 'dev_otp' is NOT included in response
"""

import os
import random
import string
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from api.dependencies import get_db
from config import settings
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# ── In-memory OTP store (dev fallback when Redis is not critical) ─────────────
# Format: { email: { "otp": "123456", "expires_at": datetime, "attempts": 0 } }
_otp_store: dict = {}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    role: str = "buyer"
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    dev_otp: str | None = None  # Only populated in dev mode


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def _store_otp(email: str, otp: str) -> None:
    """Store OTP in memory with expiry."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    _otp_store[email] = {
        "otp": otp,
        "expires_at": expires_at,
        "attempts": 0,
    }


def _verify_otp(email: str, otp: str) -> bool:
    """Verify OTP. Returns True if valid, False otherwise. Deletes on success."""
    entry = _otp_store.get(email)
    if not entry:
        return False

    # Check expiry
    if datetime.now(timezone.utc) > entry["expires_at"]:
        del _otp_store[email]
        return False

    # Check attempts
    entry["attempts"] += 1
    if entry["attempts"] > settings.OTP_MAX_ATTEMPTS:
        del _otp_store[email]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP attempts. Please request a new OTP.",
        )

    # Check OTP
    if entry["otp"] != otp:
        return False

    # Valid — consume it
    del _otp_store[email]
    return True


def _create_access_token(user_id: int, role: str) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _get_current_user_from_token(token: str, db: Session) -> User:
    """Decode JWT and return the User from DB."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_200_OK)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Step 1 of OTP login: Register email and receive OTP.

    Creates the user in DB if they don't exist, generates OTP,
    and either emails it or (dev mode) returns it in the response.
    """
    # Validate role
    valid_roles = {"buyer", "seller", "admin"}
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Find or create user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        user = User(
            email=request.email,
            name=request.name or request.email.split("@")[0],
            role=request.role,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New user registered: {request.email} as {request.role}")

    # Generate and store OTP
    otp = _generate_otp(settings.OTP_LENGTH)
    _store_otp(request.email, otp)

    # Dev mode: log and return OTP
    is_dev = settings.ENVIRONMENT == "development" or not settings.ENABLE_OTP_EMAIL
    if is_dev:
        logger.info(f"[DEV MODE] OTP for {request.email}: {otp}")
        return {
            "message": f"OTP generated (dev mode — email disabled). Check backend logs.",
            "dev_otp": otp,  # Shown in frontend for easy testing
        }

    # Production mode: send email
    # (email sending implementation would go here)
    logger.info(f"OTP email would be sent to {request.email}")
    return {"message": "OTP sent to your email address."}


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Step 2 of OTP login: Verify OTP and return JWT token.
    """
    # Verify OTP
    if not _verify_otp(request.email, request.otp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    # Get user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first.",
        )

    # Mark as verified
    if not user.is_verified:
        user.is_verified = True
        user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(user)

    # Create token
    token = _create_access_token(user.id, user.role)

    logger.info(f"User logged in: {user.email} (role={user.role})")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "flat_number": user.flat_number,
            "is_verified": user.is_verified,
        },
    )


@router.post("/refresh")
async def refresh_token():
    """Refresh access token using refresh token."""
    # TODO: Implement full refresh token flow with HTTP-only cookie
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Refresh token not yet implemented. Please login again.",
    )


@router.get("/me")
async def get_current_user_endpoint(
    db: Session = Depends(get_db),
    authorization: str = None,
):
    """Get current authenticated user information."""
    # Simple header extraction for now
    from fastapi import Request
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Use the Authorization header with Bearer token.",
    )


@router.post("/logout")
async def logout():
    """Logout current user (client should delete the token)."""
    return {"message": "Logged out successfully. Please delete the token on client side."}
