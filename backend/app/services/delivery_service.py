"""
Delivery service — business logic for in-building food delivery.

Lifecycle:
  Seller creates delivery record (order must be completed/ready)
      → status = pending
  Seller dispatches delivery
      → status = dispatched, dispatched_at = now
  Seller marks delivered
      → status = delivered, delivered_at = now
  Seller marks failed (buyer absent, etc.)
      → status = failed
"""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Delivery, Order, SellerProfile, User
from app.db.models.enums import DeliveryStatus, OrderStatus

logger = logging.getLogger(__name__)

# Valid delivery status transitions (seller-controlled)
_VALID_TRANSITIONS: dict[DeliveryStatus, set[DeliveryStatus]] = {
    DeliveryStatus.pending:    {DeliveryStatus.dispatched, DeliveryStatus.failed},
    DeliveryStatus.dispatched: {DeliveryStatus.delivered, DeliveryStatus.failed},
    DeliveryStatus.delivered:  set(),   # terminal state
    DeliveryStatus.failed:     set(),   # terminal state
}


def create_delivery(
    db: Session,
    order_id: int,
    seller_id: int,
    estimated_minutes: int | None = None,
    notes: str | None = None,
) -> Delivery:
    """
    Create a delivery record for a completed order.

    Only the seller who owns the order can create a delivery.
    The order must be in 'ready' or 'completed' status.
    """
    # Verify order exists and belongs to seller
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order.seller_id != seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your order."
        )

    if order.status not in (OrderStatus.ready, OrderStatus.completed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create delivery for order in '{order.status}' status. "
                   "Order must be 'ready' or 'completed'.",
        )

    # Prevent duplicate delivery records
    existing = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A delivery record already exists for this order.",
        )

    # Snapshot flat numbers at time of delivery creation
    seller_user = db.query(User).filter(User.id == seller_id).first()
    buyer_user = db.query(User).filter(User.id == order.buyer_id).first()

    delivery = Delivery(
        order_id=order_id,
        seller_id=seller_id,
        buyer_id=order.buyer_id,
        status=DeliveryStatus.pending,
        seller_flat=seller_user.flat_number if seller_user else None,
        buyer_flat=buyer_user.flat_number if buyer_user else None,
        estimated_minutes=estimated_minutes,
        notes=notes,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    logger.info(
        "Delivery created: order_id=%s seller=%s buyer=%s",
        order_id, seller_id, order.buyer_id
    )
    return delivery


def update_delivery_status(
    db: Session,
    delivery_id: int,
    seller_id: int,
    new_status: str,
    notes: str | None = None,
) -> Delivery:
    """
    Advance the delivery lifecycle.

    Only the owning seller can update status.
    Validates transitions against _VALID_TRANSITIONS.
    """
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Delivery not found."
        )

    if delivery.seller_id != seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your delivery."
        )

    try:
        new_status_enum = DeliveryStatus(new_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid delivery status: '{new_status}'.",
        )

    allowed = _VALID_TRANSITIONS.get(delivery.status, set())
    if new_status_enum not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition delivery from '{delivery.status}' to '{new_status}'.",
        )

    delivery.status = new_status_enum
    now = datetime.now(UTC)

    if new_status_enum == DeliveryStatus.dispatched:
        delivery.dispatched_at = now
    elif new_status_enum == DeliveryStatus.delivered:
        delivery.delivered_at = now

    if notes is not None:
        delivery.notes = notes

    db.commit()
    db.refresh(delivery)

    logger.info(
        "Delivery %s status → %s (order_id=%s)",
        delivery_id, new_status, delivery.order_id
    )
    return delivery


def get_delivery_by_order(db: Session, order_id: int) -> Delivery:
    """Return delivery for an order, or raise 404."""
    delivery = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No delivery record found for this order.",
        )
    return delivery


def get_seller_deliveries(
    db: Session, seller_id: int, skip: int = 0, limit: int = 20
) -> dict:
    """Return paginated deliveries for a seller."""
    deliveries = (
        db.query(Delivery)
        .filter(Delivery.seller_id == seller_id)
        .order_by(Delivery.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(Delivery).filter(Delivery.seller_id == seller_id).count()
    return {"deliveries": [_serialize(d) for d in deliveries], "total": total}


def _serialize(d: Delivery) -> dict:
    return {
        "id": d.id,
        "order_id": d.order_id,
        "seller_id": d.seller_id,
        "buyer_id": d.buyer_id,
        "status": d.status,
        "seller_flat": d.seller_flat,
        "buyer_flat": d.buyer_flat,
        "estimated_minutes": d.estimated_minutes,
        "notes": d.notes,
        "dispatched_at": d.dispatched_at.isoformat() if d.dispatched_at else None,
        "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
        "created_at": d.created_at.isoformat(),
    }
