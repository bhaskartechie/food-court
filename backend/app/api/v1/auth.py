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

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    store_otp,
    verify_otp,
)
from app.db.models import User
from app.schemas.auth import (
    LoginRequest,
    OTPRequest,
    OTPRequestResponse,
    OTPVerifyRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
    UserInfo,
)
from app.services import auth_service, notification_service


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

    # If the user explicitly selects a role upon login, update active role
    if request.role and request.role in ("buyer", "seller") and user.role != request.role:
        from app.db.models.enums import ApprovalStatus, UserRole
        from app.db.models.seller import SellerProfile
        user.role = UserRole(request.role)
        if user.role == UserRole.seller:
            existing_profile = db.query(SellerProfile).filter(SellerProfile.id == user.id).first()
            if not existing_profile:
                new_profile = SellerProfile(
                    id=user.id,
                    is_open=True,
                    approval_status=ApprovalStatus.approved,
                    rating=0.0,
                    review_count=0,
                    on_time_delivery_rate=100.0,
                    avg_delivery_minutes=25,
                )
                db.add(new_profile)
        db.commit()
        db.refresh(user)


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


@router.post("/switch-role", response_model=TokenResponse)
async def switch_role(
    target_role: str | None = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = DB_DEPENDENCY,
):
    """
    Switch active role between buyer and seller for the current authenticated user.
    Auto-provisions a SellerProfile if switching to seller for the first time.
    Re-issues access & refresh tokens with the new role.
    """
    from app.db.models.enums import UserRole
    from app.db.models.seller import SellerProfile

    desired_role = target_role if target_role in ("buyer", "seller") else (
        "buyer" if current_user.role == "seller" else "seller"
    )

    current_user.role = UserRole(desired_role)
    if current_user.role == UserRole.seller:
        from app.db.models.enums import ApprovalStatus
        existing_profile = db.query(SellerProfile).filter(SellerProfile.id == current_user.id).first()
        if not existing_profile:
            new_profile = SellerProfile(
                id=current_user.id,
                is_open=True,
                approval_status=ApprovalStatus.approved,
                rating=0.0,
                review_count=0,
                on_time_delivery_rate=100.0,
                avg_delivery_minutes=25,
            )
            db.add(new_profile)

    db.commit()
    db.refresh(current_user)


    access_token = create_access_token(current_user.id, current_user.role)
    refresh_token = create_refresh_token(current_user.id, current_user.role)

    logger.info("User switched active role: %s (new_role=%s)", current_user.email, current_user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserInfo(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            role=current_user.role,
            flat_number=current_user.flat_number,
            verification_status=current_user.verification_status,
            is_verified=current_user.is_verified,
        ),
    )



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


# ── Passwordless OTP Authentication ───────────────────────────────────────────


@router.post("/otp/request", response_model=OTPRequestResponse, status_code=status.HTTP_200_OK)
async def request_otp(
    request: OTPRequest,
    background_tasks: BackgroundTasks,
):
    """
    Request a one-time login password (OTP) via Email or WhatsApp.

    - Generates a 6-digit numeric cryptographic OTP.
    - Stores the OTP in Redis/memory with a 10-minute TTL.
    - Sends an email in the background via SMTP (aiosmtplib).
    - If in development mode or SMTP is unconfigured, returns dev_otp in the response for easy testing.
    """
    otp = generate_otp(length=settings.OTP_LENGTH)
    store_otp(str(request.email), otp)

    if request.channel == "whatsapp" and request.phone:
        background_tasks.add_task(
            notification_service.send_otp_whatsapp,
            phone=request.phone,
            otp=otp,
        )
    else:
        background_tasks.add_task(
            notification_service.send_otp_email,
            to_email=str(request.email),
            otp=otp,
        )

    logger.info("OTP requested for %s via %s", request.email, request.channel)

    is_dev = settings.ENVIRONMENT in ("development", "test")
    return OTPRequestResponse(
        message=f"OTP successfully dispatched to {request.email}.",
        expires_in_minutes=settings.OTP_EXPIRY_MINUTES,
        dev_otp=otp if is_dev else None,
    )


@router.post("/otp/verify", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def verify_otp_route(
    request: OTPVerifyRequest,
    db: Session = DB_DEPENDENCY,
):
    """
    Verify a one-time password (OTP) and authenticate the resident.

    - Verifies the OTP with attempt-rate limiting (max 5 attempts -> 429).
    - On success: consumes the OTP (single use).
    - Looks up the user or auto-creates a new resident account.
    - Marks user as verified.
    - Issues JWT access + refresh tokens.
    """
    is_valid = verify_otp(str(request.email), request.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please check the code and try again.",
        )

    # Find or auto-provision resident user
    display_name = request.name.strip() if request.name and request.name.strip() else str(request.email).split("@")[0]
    user, _ = auth_service.find_or_create_user(
        db,
        email=str(request.email),
        name=display_name,
        role=request.role,
    )

    # If the resident selected a role (e.g. buyer or seller) upon OTP verification, adopt active role
    if request.role and request.role in ("buyer", "seller") and user.role != request.role:
        from app.db.models.enums import ApprovalStatus, UserRole
        from app.db.models.seller import SellerProfile
        user.role = UserRole(request.role)
        if user.role == UserRole.seller:
            existing_profile = db.query(SellerProfile).filter(SellerProfile.id == user.id).first()
            if not existing_profile:
                new_profile = SellerProfile(
                    id=user.id,
                    is_open=True,
                    approval_status=ApprovalStatus.approved,
                    rating=0.0,
                    review_count=0,
                    on_time_delivery_rate=100.0,
                    avg_delivery_minutes=25,
                )
                db.add(new_profile)
        db.commit()
        db.refresh(user)


    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact support.",
        )

    auth_service.mark_user_verified(db, user)

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id, user.role)

    logger.info("User authenticated via OTP: %s (role=%s)", user.email, user.role)

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

