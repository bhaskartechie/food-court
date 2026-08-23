"""Buyer request/response schemas."""

from datetime import datetime

from pydantic import BaseModel


class BuyerProfileResponse(BaseModel):
    """Response schema for a buyer's own profile."""

    id: int
    name: str
    email: str
    phone: str | None = None
    flat_number: str | None = None
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BuyerProfileUpdate(BaseModel):
    """Request body for updating a buyer's own profile."""

    name: str | None = None
    phone: str | None = None
    flat_number: str | None = None
