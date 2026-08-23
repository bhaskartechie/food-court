"""
Delivery routes — in-building food delivery tracking.

Seller:
  POST  /api/v1/deliveries/orders/{order_id}       → create delivery record (must be ready/completed)
  PATCH /api/v1/deliveries/{delivery_id}/status    → update delivery status
  GET   /api/v1/deliveries/me                      → list my deliveries as seller

Buyer / Seller / Admin:
  GET   /api/v1/deliveries/orders/{order_id}       → check delivery status for an order

Delivery lifecycle:
  pending → dispatched → delivered | failed
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.db.models import User
from app.services import delivery_service, notification_service
from app.services.websocket_manager import get_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/deliveries", tags=["deliveries"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("seller", "admin"))


@router.post(
    "/orders/{order_id}",
    status_code=status.HTTP_201_CREATED,
)
async def create_delivery(
    order_id: int,
    estimated_minutes: int | None = Body(
        default=None, embed=True,
        description="Seller's estimate of delivery time in minutes (e.g. 10)",
        ge=1, le=120,
    ),
    notes: str | None = Body(
        default=None, embed=True,
        description="Optional note to buyer (e.g. 'Leaving food at door')",
        max_length=300,
    ),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Create a delivery record for a completed/ready order (seller only).

    The seller initiates this when they decide to deliver food to the buyer's door.
    The order must be in 'ready' or 'completed' status.
    """
    delivery = delivery_service.create_delivery(
        db,
        order_id=order_id,
        seller_id=current_user.id,
        estimated_minutes=estimated_minutes,
        notes=notes,
    )
    return {
        "id": delivery.id,
        "order_id": delivery.order_id,
        "status": delivery.status,
        "buyer_flat": delivery.buyer_flat,
        "seller_flat": delivery.seller_flat,
        "estimated_minutes": delivery.estimated_minutes,
        "notes": delivery.notes,
        "message": "Delivery created. Update status when you leave.",
    }


@router.patch("/{delivery_id}/status")
async def update_delivery_status(
    delivery_id: int,
    new_status: str = Body(..., embed=True,
        description="New status: dispatched, delivered, or failed"),
    notes: str | None = Body(default=None, embed=True, max_length=300),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Update the delivery status (seller only).

    On dispatched: buyer receives email notification + WebSocket push.
    On delivered:  buyer receives delivery confirmation email + WebSocket push.
    """
    delivery = delivery_service.update_delivery_status(
        db,
        delivery_id=delivery_id,
        seller_id=current_user.id,
        new_status=new_status,
        notes=notes,
    )

    # ── Notify buyer and push WS update ───────────────────────────────────
    buyer_user = db.query(User).filter(User.id == delivery.buyer_id).first()
    manager = get_manager()

    if buyer_user:
        # WebSocket push to all listeners for the order
        background_tasks.add_task(
            manager.broadcast_order_update,
            order_id=delivery.order_id,
            data={
                "event": "delivery_status_changed",
                "order_id": delivery.order_id,
                "delivery_id": delivery_id,
                "delivery_status": new_status,
            },
        )

        if new_status == "dispatched":
            background_tasks.add_task(
                notification_service.send_delivery_dispatched_email,
                buyer_email=buyer_user.email,
                buyer_name=buyer_user.name,
                order_id=delivery.order_id,
                seller_name=current_user.name,
                estimated_minutes=delivery.estimated_minutes,
                notes=delivery.notes,
            )
        elif new_status == "delivered":
            background_tasks.add_task(
                notification_service.send_delivery_delivered_email,
                buyer_email=buyer_user.email,
                buyer_name=buyer_user.name,
                order_id=delivery.order_id,
                seller_name=current_user.name,
            )

    return {
        "id": delivery.id,
        "order_id": delivery.order_id,
        "status": delivery.status,
        "dispatched_at": delivery.dispatched_at.isoformat() if delivery.dispatched_at else None,
        "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None,
        "notes": delivery.notes,
    }


@router.get("/me")
async def get_my_deliveries(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's delivery history, newest first."""
    return delivery_service.get_seller_deliveries(
        db, seller_id=current_user.id, skip=skip, limit=limit
    )


@router.get("/orders/{order_id}")
async def get_delivery_for_order(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Get delivery status for a specific order.

    Accessible by the buyer, seller, or admin of that order.
    """
    delivery = delivery_service.get_delivery_by_order(db, order_id=order_id)

    # Access control: only buyer, seller, or admin can view
    if current_user.role not in ("admin",) and current_user.id not in (
        delivery.buyer_id, delivery.seller_id
    ):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this delivery.",
        )

    return {
        "id": delivery.id,
        "order_id": delivery.order_id,
        "status": delivery.status,
        "seller_flat": delivery.seller_flat,
        "buyer_flat": delivery.buyer_flat,
        "estimated_minutes": delivery.estimated_minutes,
        "notes": delivery.notes,
        "dispatched_at": delivery.dispatched_at.isoformat() if delivery.dispatched_at else None,
        "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None,
        "created_at": delivery.created_at.isoformat(),
    }
