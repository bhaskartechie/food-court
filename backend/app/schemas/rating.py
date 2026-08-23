"""Rating request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, field_validator


class RatingCreateRequest(BaseModel):
    """Request body for submitting a rating on a completed order."""

    score: int
    review_text: str | None = None

    @field_validator("score")
    @classmethod
    def validate_score(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("score must be between 1 and 5")
        return v


class RatingResponse(BaseModel):
    """Response schema for a single rating."""

    id: int
    order_id: int
    seller_id: int
    rater_id: int
    score: int
    review_text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
