"""Seller management routes — with real database queries."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.models import User, SellerProfile

router = APIRouter(prefix="/api/v1/sellers", tags=["sellers"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SellerResponse(BaseModel):
    id: int
    name: str
    bio: str | None
    photo_url: str | None
    rating: float
    review_count: int
    is_approved: bool

    class Config:
        from_attributes = True


class SellerRegisterRequest(BaseModel):
    name: str
    bio: str = ""


class SellerUpdateRequest(BaseModel):
    bio: str | None = None
    photo_url: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_sellers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all approved sellers with their profiles."""
    query = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(SellerProfile.is_approved == True, User.is_active == True)  # noqa: E712
        .offset(skip)
        .limit(limit)
    )
    results = query.all()

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

    total = (
        db.query(SellerProfile)
        .filter(SellerProfile.is_approved == True)  # noqa: E712
        .count()
    )

    return {"sellers": sellers, "total": total, "skip": skip, "limit": limit}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_seller(
    request: SellerRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register as a seller. Creates a seller profile pending admin approval.

    NOTE: In production this requires authentication. For dev testing,
    pass user_id in the request body.
    """
    # TODO: Replace with actual auth dependency (get_current_user)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Seller registration requires authentication. Implement get_current_user dependency.",
    )


@router.get("/{seller_id}")
async def get_seller(seller_id: int, db: Session = Depends(get_db)):
    """Get seller profile and rating."""
    result = (
        db.query(SellerProfile, User)
        .join(User, User.id == SellerProfile.id)
        .filter(SellerProfile.id == seller_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller with id {seller_id} not found.",
        )

    seller, user = result
    return {
        "id": seller.id,
        "name": user.name,
        "email": user.email,
        "bio": seller.bio,
        "photo_url": seller.photo_url,
        "rating": seller.rating,
        "review_count": seller.review_count,
        "flat_number": user.flat_number,
        "is_approved": seller.is_approved,
    }


@router.put("/{seller_id}")
async def update_seller(
    seller_id: int,
    request: SellerUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update seller profile."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    if request.bio is not None:
        seller.bio = request.bio
    if request.photo_url is not None:
        seller.photo_url = request.photo_url

    seller.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(seller)

    return {"message": "Profile updated successfully", "id": seller_id}


@router.delete("/{seller_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seller(seller_id: int, db: Session = Depends(get_db)):
    """Delete seller account."""
    user = db.query(User).filter(User.id == seller_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found.")

    user.is_active = False
    user.updated_at = datetime.utcnow()
    db.commit()
    return None
