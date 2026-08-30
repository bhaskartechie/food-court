"""
Order routes — buyer placement and seller fulfillment.

  POST /api/v1/orders/                    → place a new order (buyer)
  GET  /api/v1/orders/{id}                → get order details (buyer/seller)
  PUT  /api/v1/orders/{id}/status         → update order status (seller/buyer cancellation)

Email notifications and WebSocket pushes are sent as BackgroundTasks
so they never delay the HTTP response.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.db.models import Order, SellerProfile, User
from app.schemas.order import OrderCreateRequest, OrderResponse, OrderStatusUpdate
from app.services import notification_service, order_service
from app.services.websocket_manager import get_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
BUYER_OR_ADMIN_DEPENDENCY = Depends(require_role("buyer", "admin"))


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    request: OrderCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = BUYER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Place a new order (buyers only).

    After placing, sends an email notification to the seller in the background.
    """
    order = order_service.create_order(db, buyer_id=current_user.id, request=request)

    # ── Notify seller via email (fire-and-forget) ─────────────────────────
    seller_user = db.query(User).filter(User.id == order.seller_id).first()
    if seller_user:
        items_summary = ", ".join(
            f"{item['quantity']}× {item['name']}" for item in (order.items or [])
        )
        background_tasks.add_task(
            notification_service.send_order_placed_email,
            seller_email=seller_user.email,
            seller_name=seller_user.name,
            order_id=order.id,
            buyer_name=current_user.name,
            items_summary=items_summary,
            total_price=float(order.total_price),
        )

    return OrderResponse.model_validate(order)


@router.get("/", status_code=status.HTTP_200_OK)
async def list_orders(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    List orders for current user:
    - If seller: returns orders placed to this seller's kitchen
    - If buyer/admin: returns orders placed by this buyer
    """
    if current_user.role == "seller":
        return order_service.get_seller_orders(
            db, seller_id=current_user.id, skip=skip, limit=limit, status_filter=status
        )
    return order_service.get_buyer_orders(
        db, buyer_id=current_user.id, skip=skip, limit=limit, status_filter=status
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Get details of a specific order."""
    order = order_service.get_order_by_id(db, order_id)
    return OrderResponse.model_validate(order)


@router.delete("/{order_id}", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Cancel a pending order (buyer only)."""
    order = order_service.cancel_order(db, order_id=order_id, buyer_id=current_user.id)
    return OrderResponse.model_validate(order)



@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_status(
    order_id: int,
    request: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Update the status of an order.

    - Sellers can accept, mark ready, or cancel.
    - Buyers can cancel (only while pending).
    - Admins can force any state.

    After update: pushes real-time WS event + sends email to buyer (background).
    """
    order = order_service.update_order_status(
        db,
        order_id=order_id,
        new_status=request.status,
        actor_id=current_user.id,
        actor_role=current_user.role,
    )

    # ── WebSocket push — real-time update to all listeners ────────────────
    manager = get_manager()
    background_tasks.add_task(
        manager.broadcast_order_update,
        order_id=order_id,
        data={
            "event": "order_status_changed",
            "order_id": order_id,
            "status": request.status,
        },
    )

    # ── Email buyer about the status change ───────────────────────────────
    buyer_user = db.query(User).filter(User.id == order.buyer_id).first()
    seller_user = db.query(User).filter(User.id == order.seller_id).first()
    if buyer_user and seller_user:
        seller_profile = db.query(SellerProfile).filter(
            SellerProfile.id == order.seller_id
        ).first()
        background_tasks.add_task(
            notification_service.send_order_status_email,
            buyer_email=buyer_user.email,
            buyer_name=buyer_user.name,
            order_id=order_id,
            new_status=request.status,
            seller_name=seller_user.name,
            seller_flat=seller_user.flat_number,
        )

    return OrderResponse.model_validate(order)
