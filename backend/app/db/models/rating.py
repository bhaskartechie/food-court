"""Rating model — buyer reviews for completed orders."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.seller import SellerProfile
    from app.db.models.user import User


class Rating(TimestampMixin, Base):
    """A rating (1–5 stars) left by a buyer after a completed order."""

    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # One rating per order — enforced by unique constraint
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, index=True, unique=True
    )
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("seller_profiles.id"), index=True, nullable=False
    )
    rater_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Score 1–5 (validated)
    score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional written review
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    seller: Mapped["SellerProfile"] = relationship(
        "SellerProfile", back_populates="ratings"
    )
    rater: Mapped["User"] = relationship("User", foreign_keys=[rater_id])
    order: Mapped["Order"] = relationship("Order")

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("score")
    def validate_score(self, key: str, value: int) -> int:
        """Score must be between 1 and 5."""
        if not (1 <= int(value) <= 5):
            raise ValueError("Rating score must be between 1 and 5")
        return int(value)
