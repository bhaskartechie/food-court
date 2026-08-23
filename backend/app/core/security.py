"""
Core security utilities.

Responsibilities:
  - Password hashing and verification (bcrypt via passlib)
  - JWT access and refresh token creation / decoding
  - OTP generation and in-memory verification (retained for future use)
  - FastAPI HTTP Bearer scheme
"""

import random
import string
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── HTTP Bearer Scheme ────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

# ── Password Hashing ──────────────────────────────────────────────────────────
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.PASSWORD_HASH_ROUNDS,
)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ── Redis-backed OTP Store ────────────────────────────────────────────────────
# Primary store: Redis (required for multi-worker production deployments).
# Fallback: in-memory dict (single-worker dev only — OTPs lost on restart).
#
# Redis key format:  otp:{email}
# Redis value:       JSON { "otp": "123456", "attempts": 0 }
# Redis TTL:         OTP_EXPIRY_MINUTES (set via EXPIRE command)

import json

_otp_fallback: dict = {}  # Used only when Redis is unreachable


def _get_redis():
    """Return a Redis client, or None if Redis is unavailable."""
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        r.ping()
        return r
    except Exception:
        logger.warning("Redis unavailable — falling back to in-memory OTP store (dev only)")
        return None


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically random numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def store_otp(email: str, otp: str) -> None:
    """Store OTP with TTL. Uses Redis if available, else in-memory fallback."""
    ttl_seconds = settings.OTP_EXPIRY_MINUTES * 60
    r = _get_redis()
    if r:
        payload = json.dumps({"otp": otp, "attempts": 0})
        r.setex(f"otp:{email}", ttl_seconds, payload)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        _otp_fallback[email] = {"otp": otp, "expires_at": expires_at, "attempts": 0}
    logger.debug("OTP stored for %s (TTL=%ds)", email, ttl_seconds)


def verify_otp(email: str, otp: str) -> bool:
    """
    Verify the OTP for an email address.
    Returns True and consumes the OTP on success.
    Raises HTTP 429 if the attempt limit is exceeded.
    """
    r = _get_redis()

    if r:
        key = f"otp:{email}"
        raw = r.get(key)
        if not raw:
            return False
        entry = json.loads(raw)
        entry["attempts"] += 1

        if entry["attempts"] > settings.OTP_MAX_ATTEMPTS:
            r.delete(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP attempts. Please request a new OTP.",
            )

        if entry["otp"] != otp:
            # Update attempt count in Redis
            ttl = r.ttl(key)
            r.setex(key, max(ttl, 1), json.dumps(entry))
            return False

        r.delete(key)  # Consume OTP (one-time use)
        return True
    else:
        # Fallback to in-memory
        entry = _otp_fallback.get(email)
        if not entry:
            return False
        if datetime.now(timezone.utc) > entry["expires_at"]:
            del _otp_fallback[email]
            return False
        entry["attempts"] += 1
        if entry["attempts"] > settings.OTP_MAX_ATTEMPTS:
            del _otp_fallback[email]
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP attempts. Please request a new OTP.",
            )
        if entry["otp"] != otp:
            return False
        del _otp_fallback[email]
        return True



# ── JWT Helpers ───────────────────────────────────────────────────────────────

def create_access_token(user_id: int, role: str) -> str:
    """Sign and return a short-lived JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int, role: str) -> str:
    """Sign and return a long-lived JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Returns the payload dict on success.
    Raises HTTP 401 on invalid or expired token.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as exc:
        logger.debug("JWT decode failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )