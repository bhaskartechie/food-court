"""Menu request/response schemas."""

from typing import Optional

from pydantic import BaseModel, field_validator

VALID_CATEGORIES = {"veg", "non-veg", "snacks", "desserts", "beverages", "other"}


class MenuCreateRequest(BaseModel):
    """Request body for creating a new menu item."""

    name: str
    description: str = ""
    category: str  # "veg" | "non-veg" | "snacks" | "desserts" | "beverages" | "other"
    price: float
    is_available: bool = True
    quantity: int = 0  # 0 = unlimited, > 0 = portion stock
    is_preorder_only: bool = False
    preorder_cutoff_time: str | None = None
    available_slots: list[str] | None = None
    max_batch_quantity: int = 0
    min_lead_time_hours: int = 2
    image_url: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
            )
        return v

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be greater than 0")
        return v


class MenuUpdateRequest(BaseModel):
    """Request body for updating an existing menu item."""

    name: str | None = None
    description: str | None = None
    price: float | None = None
    category: str | None = None
    is_available: bool | None = None
    quantity: int | None = None
    is_preorder_only: bool | None = None
    preorder_cutoff_time: str | None = None
    available_slots: list[str] | None = None
    max_batch_quantity: int | None = None
    min_lead_time_hours: int | None = None
    image_url: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(
                f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
            )
        return v


class AvailabilityRequest(BaseModel):
    """Request body for toggling menu item availability."""

    is_available: bool
    quantity: Optional[int] = None


class MenuItemResponse(BaseModel):
    """Response schema for a single menu item."""

    id: int
    seller_id: int
    name: str
    description: str | None = None
    category: str
    price: float
    is_available: bool
    quantity: int = 0
    is_preorder_only: bool = False
    preorder_cutoff_time: str | None = None
    available_slots: list[str] | None = None
    max_batch_quantity: int = 0
    min_lead_time_hours: int = 2
    image_url: str | None = None

    model_config = {"from_attributes": True}


