"""
Rating routes — submit and view seller ratings.

Authenticated (buyer):
  POST /api/v1/ratings/orders/{order_id}    → submit a rating for a completed order

Public:
  GET  /api/v1/ratings/sellers/{seller_id}  → get all ratings for a seller
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_role
from app.db.models import User
from app.schemas.rating import RatingCreateRequest
from app.services import rating_service

router = APIRouter(prefix="/api/v1/ratings", tags=["ratings"])

DB_DEPENDENCY = Depends(get_db)
BUYER_OR_ADMIN_DEPENDENCY = Depends(require_role("buyer", "admin"))


@router.post("/orders/{order_id}", status_code=201)
async def rate_order(
    order_id: int,
    request: RatingCreateRequest,
    current_user: User = BUYER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Submit a rating for a completed order (buyer only)."""
    rating = rating_service.create_rating(
        db, order_id=order_id, rater_id=current_user.id, request=request
    )
    return {
        "id": rating.id,
        "order_id": rating.order_id,
        "seller_id": rating.seller_id,
        "score": rating.score,
        "review_text": rating.review_text,
    }


@router.get("/sellers/{seller_id}")
async def get_seller_ratings(
    seller_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = DB_DEPENDENCY,
):
    """Get paginated ratings and aggregate summary for a seller (public)."""
    return rating_service.get_seller_ratings(
        db, seller_id=seller_id, skip=skip, limit=limit
    )
