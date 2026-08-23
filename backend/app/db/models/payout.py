"""Payout model — seller payout transfers via Razorpay Payouts API."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import PayoutStatus

if TYPE_CHECKING:
    from app.db.models.user import User


class Payout(TimestampMixin, Base):
    """
    A payout transfer from the platform's ledger to a seller's bank / UPI.

    Payouts are admin-triggered for MVP. Flow:
      Admin initiates   → status=pending
      Razorpay API call → status=processing, provider_payout_id set
      Webhook confirms  → status=paid | failed
    """

    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # The seller receiving the payout
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Amount to be transferred (in INR)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Payout lifecycle status
    status: Mapped[PayoutStatus] = mapped_column(
        SAEnum(PayoutStatus, name="payoutstatus", create_constraint=True),
        nullable=False,
        default=PayoutStatus.pending,
    )

    # UPI handle at the time of payout (snapshot — seller may update UPI later)
    upi_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Payment gateway used for this payout
    provider: Mapped[str] = mapped_column(
        String(50), default="razorpay", nullable=False
    )

    # Razorpay Payouts API identifier
    provider_payout_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Reason for failure (if any)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # When the payout was dispatched to Razorpay
    initiated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # When Razorpay confirmed the transfer
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    seller: Mapped["User"] = relationship("User", foreign_keys=[seller_id])
