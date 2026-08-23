"""
Payout service — manage seller payout transfers via Razorpay.

Payouts are admin-triggered for MVP safety. The Razorpay Payouts API
transfers funds from the platform account to the seller's UPI / bank.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Payout, SellerProfile
from app.db.models.enums import PayoutStatus
from app.services import ledger_service

logger = logging.getLogger(__name__)


def initiate_payout(db: Session, seller_id: int, amount: Decimal) -> Payout:
    """
    Initiate a payout for a seller (admin-triggered).
    Validates that the seller has sufficient balance.
    """
    seller_profile = (
        db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    )
    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller {seller_id} not found.",
        )

    balance = ledger_service.get_seller_balance(db, seller_id)
    if amount > balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient seller balance. "
                f"Requested: \u20b9{float(amount):.2f}, Available: \u20b9{float(balance):.2f}"
            ),
        )

    payout = Payout(
        seller_id=seller_id,
        amount=amount,
        status=PayoutStatus.pending,
        upi_id=seller_profile.upi_id,
        provider="razorpay",
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)

    logger.info(
        "Payout initiated: seller_id=%s amount=%.2f payout_id=%s",
        seller_id,
        float(amount),
        payout.id,
    )

    # TODO: call Razorpay Payouts API in production:
    # rz_client = _get_razorpay_client()
    # rz_payout = rz_client.payout.create({...})
    # payout.provider_payout_id = rz_payout["id"]
    # payout.status = PayoutStatus.processing
    # payout.initiated_at = datetime.now(timezone.utc)
    # db.commit()

    return payout


def confirm_payout(db: Session, payout_id: int, provider_payout_id: str) -> Payout:
    """Mark a payout as successfully paid (admin action / Razorpay webhook)."""
    payout = _get_payout_or_404(db, payout_id)

    if payout.status == PayoutStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payout already confirmed.",
        )

    payout.status = PayoutStatus.paid
    payout.provider_payout_id = provider_payout_id
    payout.completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(payout)

    logger.info("Payout confirmed: payout_id=%s", payout_id)
    return payout


def fail_payout(db: Session, payout_id: int, reason: str) -> Payout:
    """Mark a payout as failed (admin action / Razorpay webhook)."""
    payout = _get_payout_or_404(db, payout_id)

    if payout.status in (PayoutStatus.paid, PayoutStatus.failed):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payout already in terminal status: {payout.status}.",
        )

    payout.status = PayoutStatus.failed
    payout.failure_reason = reason
    payout.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(payout)

    logger.warning("Payout failed: payout_id=%s reason=%s", payout_id, reason)
    return payout


def list_seller_payouts(
    db: Session, seller_id: int, skip: int = 0, limit: int = 20
) -> dict:
    """Return paginated payouts for a seller."""
    payouts = (
        db.query(Payout)
        .filter(Payout.seller_id == seller_id)
        .order_by(Payout.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(Payout).filter(Payout.seller_id == seller_id).count()
    return {"payouts": [_serialize_payout(p) for p in payouts], "total": total}


def list_all_payouts(
    db: Session,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    """Return all payouts across all sellers (admin view)."""
    query = db.query(Payout)
    if status_filter:
        try:
            query = query.filter(Payout.status == PayoutStatus(status_filter))
        except ValueError:
            pass  # ignore invalid status filters

    total = query.count()
    payouts = query.order_by(Payout.created_at.desc()).offset(skip).limit(limit).all()
    return {"payouts": [_serialize_payout(p) for p in payouts], "total": total}


def _get_payout_or_404(db: Session, payout_id: int) -> Payout:
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payout {payout_id} not found.",
        )
    return payout


def _serialize_payout(p: Payout) -> dict:
    return {
        "id": p.id,
        "seller_id": p.seller_id,
        "amount": float(p.amount),
        "status": p.status,
        "upi_id": p.upi_id,
        "provider": p.provider,
        "provider_payout_id": p.provider_payout_id,
        "failure_reason": p.failure_reason,
        "initiated_at": p.initiated_at.isoformat() if p.initiated_at else None,
        "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        "created_at": p.created_at.isoformat(),
    }
