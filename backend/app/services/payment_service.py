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
import re
import urllib.parse
from datetime import UTC, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import LedgerEntry, Order, Payment, SellerProfile, User
from app.db.models.enums import LedgerEntryType, OrderStatus, PaymentStatus

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


def generate_direct_upi_payload(db: Session, order_id: int, buyer_id: int) -> dict:
    """
    Generate Direct P2PM UPI intent and details for an order.
    Bypasses third-party payment aggregators; buyer pays seller directly.
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

    seller_user = db.query(User).filter(User.id == order.seller_id).first()
    seller_profile = (
        db.query(SellerProfile).filter(SellerProfile.id == order.seller_id).first()
    )

    if not seller_profile or not seller_profile.upi_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The home chef has not configured their UPI ID yet. Direct UPI payments cannot be processed.",
        )

    seller_vpa = seller_profile.upi_id.strip()
    seller_name = (seller_profile.upi_account_name or (seller_user.name if seller_user else "Home Chef")).strip()
    amount_str = f"{Decimal(str(order.total_price)):.2f}"

    # Standard NPCI UPI URI Specification
    query_params = {
        "pa": seller_vpa,
        "pn": seller_name,
        "am": amount_str,
        "cu": "INR",
        "tr": f"ORD_{order.id}",
        "tn": f"Order_{order.id}_SocietyFood",
    }
    upi_uri = f"upi://pay?{urllib.parse.urlencode(query_params)}"

    existing = db.query(Payment).filter(Payment.order_id == order_id).first()
    if existing:
        existing.amount = order.total_price
        existing.provider = "direct_upi"
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
            provider="direct_upi",
        )
        db.add(payment)

    db.commit()
    db.refresh(payment)

    return {
        "order_id": order.id,
        "amount": order.total_price,
        "currency": "INR",
        "seller_name": seller_name,
        "seller_vpa": seller_vpa,
        "upi_uri": upi_uri,
        "payment_id": payment.id,
    }


def submit_buyer_payment(
    db: Session, order_id: int, buyer_id: int, utr_number: str
) -> Payment:
    """
    Record buyer's submitted 12-digit UPI UTR / Transaction Reference ID.
    Transitions payment status to 'submitted'.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found."
        )

    if order.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit payment details for your own orders.",
        )

    utr = utr_number.strip()
    if not re.fullmatch(r"^[0-9A-Za-z]{6,35}$", utr):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid UPI reference / UTR number. Please enter the transaction ID from your UPI app.",
        )

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        payment = Payment(
            order_id=order.id,
            buyer_id=order.buyer_id,
            seller_id=order.seller_id,
            amount=order.total_price,
            currency="INR",
            status=PaymentStatus.submitted,
            provider="direct_upi",
            utr_number=utr,
        )
        db.add(payment)
    else:
        payment.utr_number = utr
        payment.status = PaymentStatus.submitted

    db.commit()
    db.refresh(payment)
    logger.info("Buyer submitted UTR for order %s: %s", order_id, utr)
    return payment


def confirm_seller_payment(
    db: Session, order_id: int, seller_id: int
) -> Payment:
    """
    Home chef confirms receipt of direct UPI credit in their bank account.
    Marks payment captured, moves order to 'accepted', and updates SaaS pass quota/ledger.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found."
        )

    if order.seller_id != seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the designated home chef can confirm payment for this order.",
        )

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment record not found for this order.",
        )

    if payment.status == PaymentStatus.captured:
        return payment

    now = datetime.now(UTC)
    payment.status = PaymentStatus.captured
    payment.captured_at = now
    payment.seller_confirmed_at = now
    order.status = OrderStatus.accepted
    order.updated_at = now

    # SaaS Pass & Maintenance Quota Logic
    seller_profile = (
        db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    )
    if seller_profile:
        seller_profile.lifetime_orders_count = (
            seller_profile.lifetime_orders_count or 0
        ) + 1

        free_remaining = (
            seller_profile.free_orders_remaining
            if seller_profile.free_orders_remaining is not None
            else settings.FREE_ORDERS_QUOTA
        )

        if free_remaining > 0:
            seller_profile.free_orders_remaining = free_remaining - 1
            logger.info(
                "Order %s confirmed under free quota. Seller %s has %s free orders remaining.",
                order.id,
                seller_id,
                seller_profile.free_orders_remaining,
            )
        else:
            # Free quota exhausted: deduct flat maintenance fee (₹5)
            fee = Decimal(str(settings.MAINTENANCE_FEE_PER_ORDER))
            current_bal = (
                seller_profile.maintenance_balance
                if seller_profile.maintenance_balance is not None
                else Decimal("0.00")
            )
            seller_profile.maintenance_balance = current_bal - fee

            ledger_entry = LedgerEntry(
                payment_id=payment.id,
                user_id=seller_id,
                order_id=order.id,
                entry_type=LedgerEntryType.maintenance_fee,
                amount=-fee,
                balance_after=seller_profile.maintenance_balance,
                description=f"Platform maintenance fee (₹{fee}) for Order #{order.id}",
            )
            db.add(ledger_entry)
            logger.info(
                "Deducted maintenance fee ₹%s for Order %s. New balance: ₹%s",
                fee,
                order.id,
                seller_profile.maintenance_balance,
            )

    db.commit()
    db.refresh(payment)
    return payment


def get_seller_maintenance_status(db: Session, seller_id: int) -> dict:
    """Return SaaS Pass free quota, credit balance, and availability guard status."""
    seller_profile = (
        db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    )
    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found."
        )

    free_left = (
        seller_profile.free_orders_remaining
        if seller_profile.free_orders_remaining is not None
        else settings.FREE_ORDERS_QUOTA
    )
    bal = (
        seller_profile.maintenance_balance
        if seller_profile.maintenance_balance is not None
        else Decimal("0.00")
    )
    grace_threshold = Decimal(str(settings.MAINTENANCE_GRACE_LIMIT))
    is_allowed = (free_left > 0) or (bal >= grace_threshold)

    return {
        "seller_id": seller_id,
        "free_orders_remaining": free_left,
        "free_orders_total": settings.FREE_ORDERS_QUOTA,
        "maintenance_balance": bal,
        "lifetime_orders_count": seller_profile.lifetime_orders_count or 0,
        "maintenance_fee_per_order": settings.MAINTENANCE_FEE_PER_ORDER,
        "platform_upi_vpa": settings.PLATFORM_UPI_VPA,
        "platform_upi_name": settings.PLATFORM_UPI_NAME,
        "is_availability_allowed": is_allowed,
    }


def topup_seller_maintenance(
    db: Session, seller_id: int, amount: Decimal, utr_number: str
) -> dict:
    """Top up seller platform maintenance balance with submitted recharge UTR."""
    seller_profile = (
        db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    )
    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found."
        )

    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Top-up amount must be greater than zero.",
        )

    utr = utr_number.strip()
    if not re.fullmatch(r"^[0-9A-Za-z]{6,35}$", utr):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid recharge UPI reference / UTR number.",
        )

    current_bal = (
        seller_profile.maintenance_balance
        if seller_profile.maintenance_balance is not None
        else Decimal("0.00")
    )
    seller_profile.maintenance_balance = current_bal + amount

    entry = LedgerEntry(
        payment_id=None,
        user_id=seller_id,
        order_id=None,
        entry_type=LedgerEntryType.maintenance_recharge,
        amount=amount,
        balance_after=seller_profile.maintenance_balance,
        description=f"Maintenance balance recharge of ₹{amount} (UTR: {utr})",
    )
    db.add(entry)
    db.commit()
    db.refresh(seller_profile)

    return get_seller_maintenance_status(db, seller_id)

