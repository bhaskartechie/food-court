"""
Seller service — profile creation, lookup, update, and admin approval.
"""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import SellerProfile, User
from app.db.models.enums import ApprovalStatus, UserRole
from app.schemas.seller import SellerRegisterRequest, SellerUpdateRequest


def list_approved_sellers(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return paginated list of approved, active sellers."""
    query = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(
            SellerProfile.approval_status == ApprovalStatus.approved,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()

    total = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.approved)
        .count()
    )

    sellers = [
        {
            "id": seller.id,
            "name": user.name,
            "bio": seller.bio,
            "photo_url": seller.photo_url,
            "rating": seller.rating,
            "review_count": seller.review_count,
            "flat_number": user.flat_number,
        }
        for seller, user in results
    ]
    return {"sellers": sellers, "total": total, "skip": skip, "limit": limit}


def get_seller_by_id(db: Session, seller_id: int) -> tuple[SellerProfile, User]:
    """Return (SellerProfile, User) for a given seller_id, or raise 404."""
    result = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(SellerProfile.id == seller_id)
        .first()
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller {seller_id} not found.",
        )
    return result


def register_seller_profile(
    db: Session,
    user: User,
    request: SellerRegisterRequest,
) -> SellerProfile:
    """
    Create a SellerProfile for an existing user (pending admin approval).
    Raises 409 if the user already has a seller profile.
    """
    existing = db.query(SellerProfile).filter(SellerProfile.id == user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seller profile already exists for this user.",
        )

    profile = SellerProfile(
        id=user.id,
        bio=request.bio,
        approval_status=ApprovalStatus.pending,
    )
    # Update user role to seller
    user.role = UserRole.seller
    user.updated_at = datetime.now(UTC)

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_seller_profile(
    db: Session,
    seller_id: int,
    request: SellerUpdateRequest,
) -> SellerProfile:
    """Update bio, photo_url, or upi_id on a seller's profile."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )

    if request.bio is not None:
        seller.bio = request.bio
    if request.photo_url is not None:
        seller.photo_url = request.photo_url
    if request.upi_id is not None:
        seller.upi_id = request.upi_id.strip() if request.upi_id else None
        seller.is_upi_verified = bool(seller.upi_id)
    if request.upi_account_name is not None:
        seller.upi_account_name = request.upi_account_name.strip() if request.upi_account_name else None

    seller.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(seller)
    return seller


def get_pending_sellers(db: Session, skip: int = 0, limit: int = 20) -> dict:
    """Return sellers awaiting admin approval."""
    query = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(
            SellerProfile.approval_status == ApprovalStatus.pending,
            User.is_active == True,
        )
        .offset(skip)
        .limit(limit)
    )
    results = query.all()
    total = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.pending)
        .count()
    )

    sellers = [
        {
            "id": seller.id,
            "name": user.name,
            "email": user.email,
            "flat_number": user.flat_number,
        }
        for seller, user in results
    ]
    return {"sellers": sellers, "total": total}


def approve_seller(db: Session, seller_id: int) -> SellerProfile:
    """Approve a pending seller (admin action)."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )
    seller.approval_status = ApprovalStatus.approved
    seller.updated_at = datetime.now(UTC)
    db.commit()
    return seller


def reject_seller(db: Session, seller_id: int) -> User:
    """Reject a pending seller — deactivates the user (admin action)."""
    user = db.query(User).filter(User.id == seller_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found."
        )

    # Also update seller profile approval_status
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if seller:
        seller.approval_status = ApprovalStatus.rejected
        seller.updated_at = datetime.now(UTC)

    user.is_active = False
    user.updated_at = datetime.now(UTC)
    db.commit()
    return user
