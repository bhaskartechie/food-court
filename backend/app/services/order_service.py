"""Order service — order placement, status management, and history."""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Menu, Order
from app.db.models.enums import OrderStatus
from app.schemas.order import OrderCreateRequest

VALID_TRANSITIONS = {
    OrderStatus.pending: {OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.completed},
    OrderStatus.completed: set(),
    OrderStatus.cancelled: set(),
}


def create_order(db: Session, buyer_id: int, request: OrderCreateRequest) -> Order:
    """
    Place a new order for a buyer.

    Validates all menu items belong to the specified seller and are available.
    Decrements Menu.quantity for items with finite stock and auto-marks items
    unavailable when stock reaches zero.
    """
    menu_ids = [item.menu_id for item in request.items]
    db_items = (
        db.query(Menu)
        .filter(
            Menu.id.in_(menu_ids),
            Menu.seller_id == request.seller_id,
            Menu.is_available == True,
        )
        .all()
    )

    if len(db_items) != len(menu_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more menu items are unavailable or do not belong to the seller.",
        )

    # Index menu items by id for quick lookup
    menu_map: dict[int, Menu] = {item.id: item for item in db_items}

    # Validate stock and compute total
    total_price = 0.0
    items_data = []
    for req_item in request.items:
        menu = menu_map[req_item.menu_id]

        # Check finite stock (quantity=0 means unlimited)
        if menu.quantity > 0 and req_item.quantity > menu.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{menu.name}'. Available: {menu.quantity}.",
            )

        total_price += req_item.quantity * float(menu.price)
        items_data.append({
            "menu_id": req_item.menu_id,
            "name": menu.name,
            "quantity": req_item.quantity,
            "price": float(menu.price),
        })

    target_date = None
    if request.target_delivery_date:
        from datetime import date as dt_date
        if isinstance(request.target_delivery_date, str):
            try:
                target_date = dt_date.fromisoformat(request.target_delivery_date)
            except ValueError:
                target_date = None
        else:
            target_date = request.target_delivery_date

    order = Order(
        buyer_id=buyer_id,
        seller_id=request.seller_id,
        status=OrderStatus.pending,
        items=items_data,
        total_price=round(total_price, 2),
        notes=request.notes,
        is_preorder=request.is_preorder,
        delivery_slot=request.delivery_slot,
        target_delivery_date=target_date,
        delivery_type=request.delivery_type,
    )
    db.add(order)


    # ── Decrement stock for finite-quantity items ──────────────────────────
    for req_item in request.items:
        menu = menu_map[req_item.menu_id]
        if menu.quantity > 0:
            menu.quantity -= req_item.quantity
            if menu.quantity == 0:
                menu.is_available = False  # Auto-mark out of stock

    db.commit()
    db.refresh(order)
    return order


def get_order_by_id(db: Session, order_id: int) -> Order:
    """Return an Order by id, or raise 404."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found."
        )
    return order


def get_buyer_orders(
    db: Session,
    buyer_id: int,
    skip: int = 0,
    limit: int = 20,
    status_filter: str | None = None,
) -> dict:
    """Return paginated orders for a buyer, with optional status filter."""
    query = db.query(Order).filter(Order.buyer_id == buyer_id)
    if status_filter:
        try:
            query = query.filter(Order.status == OrderStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: '{status_filter}'.",
            )
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    total = db.query(Order).filter(Order.buyer_id == buyer_id).count()
    return {"orders": _serialize_orders(orders), "total": total}


def get_seller_orders(
    db: Session,
    seller_id: int,
    skip: int = 0,
    limit: int = 20,
    status_filter: str | None = None,
) -> dict:
    """Return paginated orders for a seller, with optional status filter."""
    query = db.query(Order).filter(Order.seller_id == seller_id)
    if status_filter:
        try:
            query = query.filter(Order.status == OrderStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: '{status_filter}'.",
            )
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    total = db.query(Order).filter(Order.seller_id == seller_id).count()
    return {"orders": _serialize_orders(orders), "total": total}


def update_order_status(
    db: Session,
    order_id: int,
    new_status: str,
    actor_id: int,
    actor_role: str,
) -> Order:
    """
    Update an order's status with lifecycle validation.

    Rules:
      - Sellers: pending → accepted, accepted → ready, any → cancelled
      - Buyers:  pending → cancelled
      - Admins:  any transition allowed
    """
    order = get_order_by_id(db, order_id)

    # Role-based access check
    if actor_role == "seller" and order.seller_id != actor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your order."
        )
    if actor_role == "buyer" and order.buyer_id != actor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your order."
        )

    # Lifecycle validation (admins bypass)
    try:
        new_status_enum = OrderStatus(new_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status value: '{new_status}'.",
        )

    if actor_role != "admin":
        allowed = VALID_TRANSITIONS.get(order.status, set())
        if new_status_enum not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition order from '{order.status}' to '{new_status}'.",
            )

    order.status = new_status_enum
    if new_status_enum == OrderStatus.completed:
        order.completed_at = datetime.now(UTC)
        try:
            from app.services.punctuality_service import update_seller_punctuality_on_order_completed
            update_seller_punctuality_on_order_completed(db, order.seller_id, order)
        except Exception as e:
            # Punctuality calculation should not block order status update
            pass

    db.commit()
    db.refresh(order)
    return order



def cancel_order(db: Session, order_id: int, buyer_id: int) -> Order:
    """Allow a buyer to cancel their own order (only when pending)."""
    return update_order_status(db, order_id, OrderStatus.cancelled, buyer_id, "buyer")


def _serialize_orders(orders: list[Order]) -> list[dict]:
    return [
        {
            "id": o.id,
            "buyer_id": o.buyer_id,
            "seller_id": o.seller_id,
            "status": o.status,
            "items": o.items,
            "total_price": float(o.total_price),
            "notes": o.notes,
            "is_preorder": o.is_preorder,
            "delivery_slot": o.delivery_slot,
            "target_delivery_date": str(o.target_delivery_date) if o.target_delivery_date else None,
            "delivery_type": o.delivery_type,
            "created_at": o.created_at.isoformat(),
            "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        }
        for o in orders
    ]

