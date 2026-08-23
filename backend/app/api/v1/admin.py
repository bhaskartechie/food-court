"""
Admin routes — platform management (admin role required for all endpoints).

  GET   /api/v1/admin/sellers/pending         → list sellers awaiting approval
  POST  /api/v1/admin/sellers/{id}/approve    → approve a seller
  POST  /api/v1/admin/sellers/{id}/reject     → reject a seller
  GET   /api/v1/admin/residents               → list all users
  PATCH /api/v1/admin/users/{id}/status       → activate / deactivate a user
  GET   /api/v1/admin/analytics               → platform summary stats + revenue
  POST  /api/v1/admin/orders/{id}/refund      → refund a captured payment
"""

import logging

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_role
from app.db.models import Order, Payment, SellerProfile, User
from app.db.models.enums import ApprovalStatus, PaymentStatus, UserRole
from app.services import payment_service, seller_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

DB_DEPENDENCY = Depends(get_db)
ADMIN_DEPENDENCY = Depends(require_role("admin"))


@router.get("/sellers/pending")
async def get_pending_sellers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """List all sellers awaiting admin approval."""
    return seller_service.get_pending_sellers(db, skip=skip, limit=limit)


@router.post("/sellers/{seller_id}/approve")
async def approve_seller(
    seller_id: int,
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Approve a pending seller registration."""
    seller_service.approve_seller(db, seller_id)
    return {"message": f"Seller {seller_id} approved.", "seller_id": seller_id}


@router.post("/sellers/{seller_id}/reject")
async def reject_seller(
    seller_id: int,
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Reject a pending seller (deactivates their account)."""
    seller_service.reject_seller(db, seller_id)
    return {"message": f"Seller {seller_id} rejected.", "seller_id": seller_id}


@router.get("/residents")
async def get_residents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """List all registered residents (buyers and sellers)."""
    users = (
        db.query(User).filter(User.is_active == True).offset(skip).limit(limit).all()
    )
    total = db.query(User).filter(User.is_active == True).count()
    return {
        "residents": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "flat_number": u.flat_number,
                "role": u.role,
                "verification_status": u.verification_status,
                "is_verified": u.is_verified,
                "is_active": u.is_active,
            }
            for u in users
        ],
        "total": total,
    }


@router.patch("/users/{user_id}/status")
async def set_user_status(
    user_id: int,
    is_active: bool = Body(..., embed=True, description="true to activate, false to deactivate"),
    admin_user: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Activate or deactivate a user account.

    Deactivated users cannot log in or place orders.
    Admins cannot deactivate themselves.
    """
    if user_id == admin_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot deactivate their own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_active = is_active
    db.commit()

    action = "activated" if is_active else "deactivated"
    logger.info("Admin %s %s user %s", admin_user.id, action, user_id)
    return {
        "user_id": user_id,
        "is_active": is_active,
        "message": f"User {user_id} has been {action}.",
    }


@router.get("/analytics")
async def get_analytics(
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return platform-wide summary statistics including revenue."""
    total_sellers = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.approved)
        .count()
    )
    total_buyers = (
        db.query(User)
        .filter(User.role == UserRole.buyer, User.is_active == True)
        .count()
    )
    total_orders = db.query(Order).count()
    completed_orders = db.query(Order).filter(Order.status == "completed").count()
    pending_approvals = (
        db.query(SellerProfile)
        .filter(SellerProfile.approval_status == ApprovalStatus.pending)
        .count()
    )

    # Revenue = sum of all captured payments (gross, before fees)
    total_revenue = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.status == PaymentStatus.captured)
        .scalar()
        or 0
    )
    refunded_amount = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.status == PaymentStatus.refunded)
        .scalar()
        or 0
    )

    return {
        "total_sellers": total_sellers,
        "total_buyers": total_buyers,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "pending_seller_approvals": pending_approvals,
        "revenue": {
            "total_gross_inr": float(total_revenue),
            "total_refunded_inr": float(refunded_amount),
            "net_inr": float(total_revenue - refunded_amount),
        },
    }


@router.post("/orders/{order_id}/refund")
async def refund_order_payment(
    order_id: int,
    admin_user: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Initiate a full refund for a captured payment (admin only).

    Marks the payment as refunded, calls Razorpay refund API,
    and records a debit ledger entry for the seller.
    """
    payment = payment_service.refund_payment(db, order_id=order_id, admin_id=admin_user.id)
    return {
        "message": f"Refund initiated for order #{order_id}.",
        "order_id": order_id,
        "payment_id": payment.id,
        "amount_refunded": float(payment.amount),
        "status": payment.status,
    }
