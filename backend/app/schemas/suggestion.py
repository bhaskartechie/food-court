"""Dish Suggestion request/response schemas — Community Cravings Marketplace."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator

VALID_CATEGORIES = {"veg", "non-veg", "snacks", "desserts", "beverages", "other"}


class SuggestionCreateRequest(BaseModel):
    """Request body for proposing a new dish suggestion."""

    title: str
    description: str | None = None
    category: str = "veg"
    target_date: date | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Dish title cannot be empty")
        return v.strip()

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
        return v


class SuggestionClaimRequest(BaseModel):
    """Request body for a home chef claiming a community suggestion and launching pre-orders."""

    price: float | None = None
    max_batch_quantity: int = 15
    preorder_cutoff_time: str = "11:00"
    available_slots: list[str] = ["lunch_today", "dinner_today"]
    min_lead_time_hours: int = 2
    existing_menu_id: int | None = None

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Price must be positive")
        return v


class SuggestionResponse(BaseModel):
    """Response schema for a single community dish suggestion."""

    id: int
    user_id: int
    user_name: str | None = None
    user_flat: str | None = None
    title: str
    description: str | None = None
    category: str
    target_date: date | None = None
    upvotes_count: int
    status: str
    accepted_by_seller_id: int | None = None
    seller_name: str | None = None
    seller_flat: str | None = None
    created_menu_id: int | None = None
    menu_name: str | None = None
    menu_price: float | None = None
    has_upvoted: bool = False
    match_score: int | None = None
    match_reasons: list[str] | None = None
    matching_menu_items: list[dict] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}



class UpvoteResponse(BaseModel):
    """Response returned when an upvote is toggled."""

    suggestion_id: int
    upvotes_count: int
    has_upvoted: bool
    message: str
