"""SellerProfile model — extended profile for users with role=seller."""

import re
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import ApprovalStatus

if TYPE_CHECKING:
    from app.db.models.menu import Menu
    from app.db.models.rating import Rating
    from app.db.models.user import User


class SellerProfile(TimestampMixin, Base):
    """
    One-to-one extension of User for sellers.

    Uses the User's primary key as both PK and FK so a SellerProfile
    can only exist for an existing User with role=seller.
    """

    __tablename__ = "seller_profiles"

    # Uses the User's primary key as both PK and FK
    id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)

    # Seller bio — text area in UI describing what products they supply
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Payment Details ───────────────────────────────────────────────────────
    # Store encrypted in production; plaintext acceptable for MVP
    bank_account: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upi_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Profile photo URL (CDN / S3 link)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Aggregate Rating (Customer Reviews) ───────────────────────────────────
    # Rating 1–5 with 0.2 precision; updated by rating_service after each review
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Punctuality & Reliability Metrics (Automated) ─────────────────────────
    # Computed from completed order timestamps vs. estimated/slot deadlines
    on_time_delivery_rate: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    punctuality_rating: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    avg_delivery_minutes: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    total_orders_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


    # ── Availability ──────────────────────────────────────────────────────────
    # Sellers can toggle themselves open/closed without affecting menus or approval.
    # Buyers only see open sellers; closed sellers cannot receive new orders.
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Admin Approval ────────────────────────────────────────────────────────
    # Sellers are only visible to buyers after admin approval
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus, name="approvalstatus", create_constraint=True),
        nullable=False,
        default=ApprovalStatus.pending,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="seller_profile")
    menus: Mapped[list["Menu"]] = relationship("Menu", back_populates="seller")
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="seller")

    # ── Convenience Property (backward compatibility) ─────────────────────────
    @property
    def is_approved(self) -> bool:
        """True when approval_status is 'approved'. Read-only shortcut."""
        return self.approval_status == ApprovalStatus.approved

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("upi_id")
    def validate_upi_id(self, key: str, value: str | None) -> str | None:
        """Basic UPI ID format validation: localpart@bankhandle."""
        if value is not None and not re.fullmatch(
            r"[a-zA-Z0-9.\-_]+@[a-zA-Z]{3,}", value
        ):
            raise ValueError(
                "UPI ID format invalid (expected: handle@bank, e.g. john@paytm)"
            )
        return value

    @validates("rating")
    def validate_rating(self, key: str, value: float) -> float:
        """Rating must be between 0.0 and 5.0."""
        if not (0.0 <= float(value) <= 5.0):
            raise ValueError("Rating must be between 0.0 and 5.0")
        return value
