"""Payment and ledger request/response schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PaymentInitiateResponse(BaseModel):
    """Response after initiating a Razorpay order."""
    razorpay_order_id: str
    amount: int           # Amount in paise (INR)
    currency: str
    key_id: str
    payment_id: int       # Internal DB Payment.id
    order_id: int


class PaymentCaptureRequest(BaseModel):
    """Request body for confirming a Razorpay payment from the frontend."""
    provider_payment_id: str   # razorpay_payment_id from Razorpay callback
    provider_signature: str    # razorpay_signature from Razorpay callback


class PaymentResponse(BaseModel):
    """Full payment detail response."""
    id: int
    order_id: int
    buyer_id: int
    seller_id: int
    amount: Decimal
    currency: str
    status: str
    provider: str
    provider_order_id: str | None = None
    provider_payment_id: str | None = None
    failure_reason: str | None = None
    captured_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LedgerEntryResponse(BaseModel):
    """A single seller ledger entry."""
    id: int
    order_id: int
    entry_type: str
    amount: Decimal
    balance_after: Decimal
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SellerBalanceResponse(BaseModel):
    """Seller's current ledger balance."""
    seller_id: int
    balance: Decimal
    currency: str = "INR"
