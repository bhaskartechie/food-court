"""Order request/response schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator

VALID_STATUSES = {"pending", "accepted", "ready", "completed", "cancelled"}


class OrderItem(BaseModel):
    """A single line item within an order."""

    menu_id: int
    name: str
    quantity: int
    price: float


class OrderCreateRequest(BaseModel):
    """Request body for placing a new order."""

    seller_id: int
    items: list[OrderItem]
    notes: str | None = None

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v


class OrderStatusUpdate(BaseModel):
    """Request body for a seller updating order status."""

    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(VALID_STATUSES))}"
            )
        return v


class OrderResponse(BaseModel):
    """Response schema for a single order."""

    id: int
    buyer_id: int
    seller_id: int
    status: str
    items: Any  # Parsed from JSON text
    total_price: float
    notes: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
