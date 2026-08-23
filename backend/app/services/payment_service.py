"""
Payment service — Razorpay integration for order payments.

Flow:
  1. create_payment_order()  → creates DB Payment record + Razorpay order
  2. capture_payment()       → verifies Razorpay signature + captures payment
  3. handle_webhook()        → processes Razorpay webhook events (idempotent)
  4. get_payment_by_order()  → query helper
"""

import hashlib
import hmac
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Order, Payment
from app.db.models.enums import OrderStatus, PaymentStatus

logger = logging.getLogger(__name__)


def _get_razorpay_client():
    """Return a lazily-initialised Razorpay client."""
    try:
        import razorpay  # type: ignore[import]

        return razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay SDK not installed. Run: pip install razorpay",
        )


def create_payment_order(db: Session, order_id: int, buyer_id: int) -> dict:
    """
    Initiate a payment for an order.

    Creates a Payment record in DB and a Razorpay order on their platform.
    Returns data needed by the Razorpay JS checkout widget.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found."
        )

    if order.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only pay for your own orders.",
        )

    if order.status != OrderStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot initiate payment for an order in '{order.status}' status.",
        )

    # Check if payment already captured
    existing = db.query(Payment).filter(Payment.order_id == order_id).first()
    if existing and existing.status == PaymentStatus.captured:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment already captured for this order.",
        )

    # Razorpay uses paise (smallest currency unit)
    amount_paise = int(Decimal(str(order.total_price)) * 100)

    rz_client = _get_razorpay_client()
    rz_order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"order_{order.id}",
        "notes": {
            "order_id": str(order.id),
            "buyer_id": str(order.buyer_id),
            "seller_id": str(order.seller_id),
        },
    }

    try:
        rz_order = rz_client.order.create(data=rz_order_data)
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway error. Please try again.",
        )

    # Create or reuse Payment record
    if existing:
        existing.provider_order_id = rz_order["id"]
        existing.status = PaymentStatus.created
        payment = existing
    else:
        payment = Payment(
            order_id=order.id,
            buyer_id=order.buyer_id,
            seller_id=order.seller_id,
            amount=order.total_price,
            currency="INR",
            status=PaymentStatus.created,
            provider="razorpay",
            provider_order_id=rz_order["id"],
        )
        db.add(payment)

    db.commit()
    db.refresh(payment)

    logger.info(
        "Payment order created: order_id=%s razorpay_order_id=%s amount=%.2f",
        order.id,
        rz_order["id"],
        float(order.total_price),
    )

    return {
        "razorpay_order_id": rz_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID,
        "payment_id": payment.id,
        "order_id": order.id,
    }


def capture_payment(
    db: Session,
    order_id: int,
    buyer_id: int,
    provider_payment_id: str,
    provider_signature: str,
) -> Payment:
    """
    Verify the Razorpay payment signature and mark payment as captured.

    Called by the frontend after the Razorpay checkout widget completes.
    Also auto-progresses the order status to 'accepted'.
    """
    from app.services import ledger_service

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment record not found. Initiate payment first.",
        )

    if payment.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to capture this payment.",
        )

    if payment.status == PaymentStatus.captured:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment already captured.",
        )

    # Verify Razorpay HMAC-SHA256 signature
    _verify_razorpay_signature(
        provider_order_id=payment.provider_order_id,
        provider_payment_id=provider_payment_id,
        provider_signature=provider_signature,
    )

    # Update payment record
    payment.provider_payment_id = provider_payment_id
    payment.provider_signature = provider_signature
    payment.status = PaymentStatus.captured
    payment.captured_at = datetime.now(UTC)
    db.flush()

    # Auto-progress order to 'accepted'
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        order.status = OrderStatus.accepted

    # Create ledger entries (credit seller, record platform fee)
    ledger_service.record_payment_credit(db, payment)

    db.commit()
    db.refresh(payment)

    logger.info(
        "Payment captured: order_id=%s payment_id=%s amount=%.2f",
        order_id,
        provider_payment_id,
        float(payment.amount),
    )

    return payment


def handle_webhook(db: Session, payload: bytes, signature: str) -> dict:
    """
    Process a Razorpay webhook event.

    Verifies the webhook signature using HMAC-SHA256 before processing.
    All handlers are idempotent.
    """
    import json

    # Verify webhook signature
    expected = hmac.new(
        key=settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        )

    event = json.loads(payload)
    event_type = event.get("event")
    logger.info("Razorpay webhook received: %s", event_type)

    if event_type == "payment.captured":
        _handle_payment_captured_webhook(db, event)
    elif event_type == "payment.failed":
        _handle_payment_failed_webhook(db, event)
    elif event_type == "refund.created":
        _handle_refund_webhook(db, event)

    return {"status": "ok", "event": event_type}


def _handle_payment_captured_webhook(db: Session, event: dict) -> None:
    """Handle payment.captured webhook — idempotent."""
    from app.services import ledger_service

    payment_data = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id_note = payment_data.get("notes", {}).get("order_id")
    if not order_id_note:
        return

    payment = db.query(Payment).filter(Payment.order_id == int(order_id_note)).first()
    if not payment or payment.status == PaymentStatus.captured:
        return  # Already captured or not found — idempotent

    payment.provider_payment_id = payment_data.get("id")
    payment.status = PaymentStatus.captured
    payment.captured_at = datetime.now(UTC)

    order = db.query(Order).filter(Order.id == payment.order_id).first()
    if order:
        order.status = OrderStatus.accepted

    ledger_service.record_payment_credit(db, payment)
    db.commit()


def _handle_payment_failed_webhook(db: Session, event: dict) -> None:
    """Handle payment.failed webhook."""
    payment_data = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id_note = payment_data.get("notes", {}).get("order_id")
    if not order_id_note:
        return

    payment = db.query(Payment).filter(Payment.order_id == int(order_id_note)).first()
    if payment and payment.status == PaymentStatus.created:
        payment.status = PaymentStatus.failed
        payment.failure_reason = payment_data.get("error_description", "Payment failed")
        db.commit()


def _handle_refund_webhook(db: Session, event: dict) -> None:
    """Handle refund.created webhook. (TODO: implement full refund processing)"""
    pass


def _verify_razorpay_signature(
    provider_order_id: str | None,
    provider_payment_id: str,
    provider_signature: str,
) -> None:
    """Verify Razorpay payment signature using HMAC-SHA256."""
    if not provider_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Razorpay order ID.",
        )

    message = f"{provider_order_id}|{provider_payment_id}"
    expected = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode(),
        msg=message.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, provider_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature. Payment verification failed.",
        )


def refund_payment(db: Session, order_id: int, admin_id: int) -> Payment:
    """
    Initiate a full refund for a captured payment (admin only).

    Marks the payment as refunded in DB and calls Razorpay refund API.
    Creates a ledger debit entry via ledger_service.record_refund().
    """
    from app.services import ledger_service

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payment record found for this order.",
        )

    if payment.status != PaymentStatus.captured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot refund a payment in '{payment.status}' status. "
                   "Only 'captured' payments can be refunded.",
        )

    # Call Razorpay refund API
    amount_paise = int(Decimal(str(payment.amount)) * 100)
    try:
        rz_client = _get_razorpay_client()
        rz_client.payment.refund(payment.provider_payment_id, {"amount": amount_paise})
        logger.info(
            "Razorpay refund initiated: payment_id=%s amount_paise=%d",
            payment.provider_payment_id, amount_paise
        )
    except Exception as exc:
        logger.error("Razorpay refund failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Refund request to payment gateway failed. Please try again.",
        )

    # Update payment status
    payment.status = PaymentStatus.refunded
    payment.failure_reason = f"Refunded by admin (user_id={admin_id})"
    db.flush()

    # Record ledger debit entry
    ledger_service.record_refund(db, payment)

    db.commit()
    db.refresh(payment)
    logger.info("Payment refunded: order_id=%s payment_id=%s", order_id, payment.id)
    return payment


def get_payment_by_order(db: Session, order_id: int) -> Payment | None:
    """Return the Payment for an order, or None if not found."""
    return db.query(Payment).filter(Payment.order_id == order_id).first()

