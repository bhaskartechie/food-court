"""Rating service — create ratings and compute seller aggregates."""

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Order, Rating, SellerProfile
from app.db.models.enums import OrderStatus
from app.schemas.rating import RatingCreateRequest


def create_rating(
    db: Session,
    order_id: int,
    rater_id: int,
    request: RatingCreateRequest,
) -> Rating:
    """
    Submit a rating for a completed order.

    Validates:
      - The order exists and belongs to the rater (as buyer)
      - The order is in 'completed' status
      - No duplicate rating for this order
    Then updates the seller's aggregate rating.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found."
        )

    if order.buyer_id != rater_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your order."
        )

    if order.status != OrderStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only rate completed orders.",
        )

    existing = db.query(Rating).filter(Rating.order_id == order_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already rated this order.",
        )

    rating = Rating(
        order_id=order_id,
        seller_id=order.seller_id,
        rater_id=rater_id,
        score=request.score,
        review_text=request.review_text,
    )
    db.add(rating)
    db.flush()

    _update_seller_aggregate(db, order.seller_id)

    db.commit()
    db.refresh(rating)
    return rating


def get_seller_ratings(
    db: Session, seller_id: int, skip: int = 0, limit: int = 20
) -> dict:
    """Return paginated ratings for a seller with distribution summary."""
    ratings = (
        db.query(Rating)
        .filter(Rating.seller_id == seller_id)
        .order_by(Rating.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(Rating).filter(Rating.seller_id == seller_id).count()

    avg_result = (
        db.query(func.avg(Rating.score)).filter(Rating.seller_id == seller_id).scalar()
    )
    average = round(float(avg_result), 2) if avg_result else 0.0

    distribution = {str(i): 0 for i in range(1, 6)}
    for r in db.query(Rating).filter(Rating.seller_id == seller_id).all():
        distribution[str(r.score)] = distribution.get(str(r.score), 0) + 1

    return {
        "ratings": [
            {
                "id": r.id,
                "score": r.score,
                "review_text": r.review_text,
                "rater_id": r.rater_id,
                "created_at": r.created_at.isoformat(),
            }
            for r in ratings
        ],
        "average": average,
        "total": total,
        "distribution": distribution,
    }


def _update_seller_aggregate(db: Session, seller_id: int) -> None:
    """Recompute and persist the seller's average rating and review count."""
    result = (
        db.query(func.avg(Rating.score), func.count(Rating.id))
        .filter(Rating.seller_id == seller_id)
        .first()
    )
    avg_score, count = result if result else (0, 0)

    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if seller:
        seller.rating = round(float(avg_score or 0), 2)
        seller.review_count = count or 0
