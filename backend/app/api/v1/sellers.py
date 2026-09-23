"""
Seller routes — browse sellers, manage profiles, and order management.

Public:
  GET  /api/v1/sellers/                   → list approved sellers
  GET  /api/v1/sellers/{id}               → get seller detail

Authenticated (seller or admin):
  POST /api/v1/sellers/register           → register as a seller
  GET  /api/v1/sellers/me                 → get own profile
  PUT  /api/v1/sellers/me                 → update own profile
  GET  /api/v1/sellers/me/orders          → get own orders (with optional status filter)
  PATCH /api/v1/sellers/me/open          → toggle open/closed status
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.core.config import settings
from app.db.models import User
from app.schemas.seller import SellerRegisterRequest, SellerUpdateRequest
from app.services import order_service, seller_service

router = APIRouter(prefix="/api/v1/sellers", tags=["sellers"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("seller", "admin"))


@router.get("/")
async def list_sellers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = DB_DEPENDENCY,
):
    """List all approved sellers (public — no auth required)."""
    return seller_service.list_approved_sellers(db, skip=skip, limit=limit)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_seller(
    request: SellerRegisterRequest,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Register the authenticated user as a seller.
    Creates a SellerProfile pending admin approval.
    """
    profile = seller_service.register_seller_profile(db, current_user, request)
    return {
        "message": "Seller registration submitted. Awaiting admin approval.",
        "seller_id": profile.id,
    }


@router.get("/me")
async def get_my_seller_profile(
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's own profile."""
    seller, user = seller_service.get_seller_by_id(db, current_user.id)
    return {
        "id": seller.id,
        "name": user.name,
        "email": user.email,
        "bio": seller.bio,
        "photo_url": seller.photo_url,
        "upi_id": seller.upi_id,
        "upi_account_name": getattr(seller, "upi_account_name", None),
        "is_upi_verified": getattr(seller, "is_upi_verified", bool(seller.upi_id)),
        "free_orders_remaining": getattr(seller, "free_orders_remaining", 50),
        "maintenance_balance": float(getattr(seller, "maintenance_balance", 0.0)),
        "rating": seller.rating,
        "review_count": seller.review_count,
        "flat_number": user.flat_number,
        "is_approved": seller.is_approved,
        "is_open": seller.is_open,
    }


@router.put("/me")
async def update_my_profile(
    request: SellerUpdateRequest,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Update the authenticated seller's own profile."""
    seller_service.update_seller_profile(db, current_user.id, request)
    return {"message": "Profile updated successfully."}


@router.get("/me/orders")
async def get_my_orders(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status",
        description="Filter by order status: pending, accepted, ready, completed, cancelled"),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's orders, newest first. Optionally filter by status."""
    return order_service.get_seller_orders(
        db,
        seller_id=current_user.id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
    )


@router.patch("/me/open")
async def toggle_open_status(
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Toggle the seller's open/closed status.

    When closed (is_open=False), buyers cannot place new orders.
    Closed status does not affect existing orders or menu visibility.
    """
    seller, user = seller_service.get_seller_by_id(db, current_user.id)

    # When opening the kitchen, ensure UPI is configured and maintenance quota is healthy
    if not seller.is_open:
        if not seller.upi_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please configure your UPI ID in Kitchen Settings / Profile before opening your kitchen for orders.",
            )
        free_left = (
            seller.free_orders_remaining
            if seller.free_orders_remaining is not None
            else settings.FREE_ORDERS_QUOTA
        )
        bal = float(seller.maintenance_balance or 0.0)
        if free_left <= 0 and bal < settings.MAINTENANCE_GRACE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Your free quota has expired and maintenance balance is below the grace limit. Please recharge credits to open your kitchen.",
            )

    seller.is_open = not seller.is_open
    db.commit()
    db.refresh(seller)
    state = "open" if seller.is_open else "closed"
    return {
        "is_open": seller.is_open,
        "message": f"You are now {state} for orders.",
    }


@router.get("/{seller_id}")
async def get_seller(seller_id: int, db: Session = DB_DEPENDENCY):
    """Get a seller's public profile by id."""
    seller, user = seller_service.get_seller_by_id(db, seller_id)
    return {
        "id": seller.id,
        "name": user.name,
        "bio": seller.bio,
        "photo_url": seller.photo_url,
        "rating": seller.rating,
        "review_count": seller.review_count,
        "flat_number": user.flat_number,
        "is_approved": seller.is_approved,
        "is_open": seller.is_open,
    }
