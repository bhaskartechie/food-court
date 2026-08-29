"""Seller request/response schemas."""

from pydantic import BaseModel


class SellerRegisterRequest(BaseModel):
    """Request body for a user registering as a seller."""

    bio: str = ""


class SellerUpdateRequest(BaseModel):
    """Request body for updating a seller's own profile."""

    bio: str | None = None
    photo_url: str | None = None
    upi_id: str | None = None


class SellerResponse(BaseModel):
    """Compact seller card (used in list views)."""

    id: int
    name: str
    bio: str | None = None
    photo_url: str | None = None
    rating: float
    review_count: int
    on_time_delivery_rate: float = 100.0
    punctuality_rating: float = 5.0
    avg_delivery_minutes: int = 25
    total_orders_completed: int = 0
    flat_number: str | None = None
    is_approved: bool

    model_config = {"from_attributes": True}


class SellerDetailResponse(SellerResponse):
    """Full seller detail (includes email, used in admin and own-profile views)."""

    email: str

