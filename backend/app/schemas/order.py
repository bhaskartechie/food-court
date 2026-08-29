"""Order request/response schemas."""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator

VALID_STATUSES = {"pending", "accepted", "ready", "completed", "cancelled"}
VALID_DELIVERY_TYPES = {"doorstep", "self_pickup"}


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
    is_preorder: bool = False
    delivery_slot: str | None = None
    target_delivery_date: str | None = None
    delivery_type: str = "doorstep"

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list) -> list:
        if not v:
            raise ValueError("Order must contain at least one item")
        return v

    @field_validator("delivery_type")
    @classmethod
    def validate_delivery_type(cls, v: str) -> str:
        if v not in VALID_DELIVERY_TYPES:
            raise ValueError(f"delivery_type must be one of: {', '.join(sorted(VALID_DELIVERY_TYPES))}")
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
    is_preorder: bool = False
    delivery_slot: str | None = None
    target_delivery_date: Any | None = None
    delivery_type: str = "doorstep"
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}

