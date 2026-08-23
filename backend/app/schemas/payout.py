"""Payout request/response schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class PayoutInitiateRequest(BaseModel):
    """Admin request to initiate a seller payout."""

    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Payout amount must be greater than zero")
        return v


class PayoutConfirmRequest(BaseModel):
    """Admin request to confirm a payout was successfully transferred."""

    provider_payout_id: str


class PayoutFailRequest(BaseModel):
    """Admin request to mark a payout as failed."""

    reason: str


class PayoutResponse(BaseModel):
    """Full payout detail response."""

    id: int
    seller_id: int
    amount: Decimal
    status: str
    upi_id: str | None = None
    provider: str
    provider_payout_id: str | None = None
    failure_reason: str | None = None
    initiated_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
