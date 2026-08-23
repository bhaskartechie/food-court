"""
Payment routes — initiate, capture, and query order payments.

Buyer flow:
  POST /api/v1/payments/orders/{order_id}/initiate → get Razorpay checkout data
  POST /api/v1/payments/orders/{order_id}/capture  → confirm payment after widget

Webhook (Razorpay server → our server):
  POST /api/v1/payments/webhook                    → auto-capture events

Seller:
  GET  /api/v1/payments/ledger/me                  → own ledger entries
  GET  /api/v1/payments/balance/me                 → current balance

Shared:
  GET  /api/v1/payments/orders/{order_id}          → payment detail
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.db.models import User
from app.schemas.payment import (
    PaymentCaptureRequest,
    PaymentInitiateResponse,
    PaymentResponse,
    SellerBalanceResponse,
)
from app.services import ledger_service, payment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
BUYER_OR_ADMIN_DEPENDENCY = Depends(require_role("buyer", "admin"))


@router.post(
    "/orders/{order_id}/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def initiate_payment(
    order_id: int,
    current_user: User = BUYER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Initiate payment for an order.

    Returns Razorpay checkout data. The frontend uses this to open
    the Razorpay JS checkout widget.
    """
    data = payment_service.create_payment_order(
        db, order_id=order_id, buyer_id=current_user.id
    )
    return PaymentInitiateResponse(**data)


@router.post("/orders/{order_id}/capture", response_model=PaymentResponse)
async def capture_payment(
    order_id: int,
    request: PaymentCaptureRequest,
    current_user: User = BUYER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Confirm a Razorpay payment after the checkout widget completes.

    The Razorpay JS SDK calls the `handler` callback with
    `razorpay_payment_id` and `razorpay_signature` — pass those here.
    """
    payment = payment_service.capture_payment(
        db,
        order_id=order_id,
        buyer_id=current_user.id,
        provider_payment_id=request.provider_payment_id,
        provider_signature=request.provider_signature,
    )
    return PaymentResponse.model_validate(payment)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def razorpay_webhook(request: Request, db: Session = DB_DEPENDENCY):
    """
    Razorpay webhook endpoint.

    Configure this URL in Razorpay Dashboard:
      Settings → Webhooks → Add New Webhook
      URL: https://your-domain/api/v1/payments/webhook

    Events handled: payment.captured, payment.failed, refund.created
    """
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    return payment_service.handle_webhook(db, payload=payload, signature=signature)


@router.get("/orders/{order_id}", response_model=PaymentResponse)
async def get_payment(
    order_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Get payment detail for an order (buyer, seller, or admin)."""
    payment = payment_service.get_payment_by_order(db, order_id=order_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payment found for this order.",
        )

    if current_user.role not in ("admin",) and current_user.id not in (
        payment.buyer_id,
        payment.seller_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment.",
        )

    return PaymentResponse.model_validate(payment)


@router.get("/ledger/me")
async def get_my_ledger(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_role("seller", "admin")),
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's ledger entries."""
    return ledger_service.get_seller_ledger(
        db, seller_id=current_user.id, skip=skip, limit=limit
    )


@router.get("/balance/me", response_model=SellerBalanceResponse)
async def get_my_balance(
    current_user: User = Depends(require_role("seller", "admin")),
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's current balance."""
    balance = ledger_service.get_seller_balance(db, seller_id=current_user.id)
    return SellerBalanceResponse(
        seller_id=current_user.id,
        balance=balance,
        currency="INR",
    )
