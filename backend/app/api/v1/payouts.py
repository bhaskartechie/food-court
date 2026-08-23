"""
Payout routes — seller payout history and admin payout management.

Seller:
  GET  /api/v1/payouts/me                     → own payout history

Admin:
  GET  /api/v1/payouts/                       → all payouts (filterable by status)
  POST /api/v1/payouts/{seller_id}/initiate   → initiate a seller payout
  PUT  /api/v1/payouts/{payout_id}/confirm    → mark payout as paid
  PUT  /api/v1/payouts/{payout_id}/fail       → mark payout as failed
"""

import logging

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_role
from app.db.models import User
from app.schemas.payout import (
    PayoutConfirmRequest,
    PayoutFailRequest,
    PayoutInitiateRequest,
    PayoutResponse,
)
from app.services import payout_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payouts", tags=["payouts"])

DB_DEPENDENCY = Depends(get_db)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("seller", "admin"))
ADMIN_DEPENDENCY = Depends(require_role("admin"))


@router.get("/me")
async def get_my_payouts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Return the authenticated seller's payout history."""
    return payout_service.list_seller_payouts(
        db, seller_id=current_user.id, skip=skip, limit=limit
    )


@router.get("/")
async def list_all_payouts(
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """List all payouts across all sellers (admin only)."""
    return payout_service.list_all_payouts(
        db, status_filter=status_filter, skip=skip, limit=limit
    )


@router.post(
    "/{seller_id}/initiate",
    response_model=PayoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def initiate_payout(
    seller_id: int,
    request: PayoutInitiateRequest,
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Initiate a payout for a seller (admin only)."""
    payout = payout_service.initiate_payout(
        db, seller_id=seller_id, amount=request.amount
    )
    return PayoutResponse.model_validate(payout)


@router.put("/{payout_id}/confirm", response_model=PayoutResponse)
async def confirm_payout(
    payout_id: int,
    request: PayoutConfirmRequest,
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Mark a payout as successfully paid (admin only)."""
    payout = payout_service.confirm_payout(
        db, payout_id=payout_id, provider_payout_id=request.provider_payout_id
    )
    return PayoutResponse.model_validate(payout)


@router.put("/{payout_id}/fail", response_model=PayoutResponse)
async def fail_payout(
    payout_id: int,
    request: PayoutFailRequest,
    _: User = ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Mark a payout as failed (admin only)."""
    payout = payout_service.fail_payout(db, payout_id=payout_id, reason=request.reason)
    return PayoutResponse.model_validate(payout)
