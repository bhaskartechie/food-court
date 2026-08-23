"""Delivery model — tracks in-building food delivery from seller's flat to buyer's flat.

Option A: Seller carries food to buyer's door within the residential society.
No third-party courier. Simple lifecycle: pending → dispatched → delivered | failed.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import DeliveryStatus

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.user import User


class Delivery(TimestampMixin, Base):
    """
    Tracks the in-building delivery of a completed order.

    One delivery per order (enforced by unique constraint on order_id).
    Created by the seller once an order is completed and they choose to deliver.

    Lifecycle:
        pending     → Delivery record created; seller has not left yet
        dispatched  → Seller picked up the food and is walking to buyer's flat
        delivered   → Food handed to buyer at their door
        failed      → Delivery could not be completed (buyer absent, etc.)
    """

    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # One delivery per order
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), unique=True, index=True, nullable=False
    )

    # Parties involved
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    buyer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Delivery lifecycle status
    status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(DeliveryStatus, name="deliverystatus", create_constraint=True),
        nullable=False,
        default=DeliveryStatus.pending,
    )

    # ── Location Snapshots ────────────────────────────────────────────────────
    # Captured at delivery creation time so changing flat numbers doesn't break history
    seller_flat: Mapped[str | None] = mapped_column(String(50), nullable=True)
    buyer_flat: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Delivery Details ──────────────────────────────────────────────────────
    # Seller's estimated delivery time (e.g., 10 minutes)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Optional notes from seller (e.g., "Leaving at door", "Ring bell twice")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    # When the seller actually left to deliver
    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # When the food was handed to the buyer
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    order: Mapped["Order"] = relationship("Order")
    seller: Mapped["User"] = relationship("User", foreign_keys=[seller_id])
    buyer: Mapped["User"] = relationship("User", foreign_keys=[buyer_id])
