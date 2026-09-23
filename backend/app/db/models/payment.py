"""Payment model — Razorpay payment record linked to an Order."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import PaymentStatus

if TYPE_CHECKING:
    from app.db.models.ledger import LedgerEntry
    from app.db.models.order import Order
    from app.db.models.user import User


class Payment(TimestampMixin, Base):
    """
    Records a payment transaction for an Order via Razorpay.

    Flow:
      1. Buyer initiates  → status=created, provider_order_id populated
      2. Buyer pays via Razorpay widget → webhook fires / frontend confirms
      3. Signature verified → status=captured, ledger entries created
      4. On refund → status=refunded
    """

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # One payment per order (enforced by unique constraint)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), unique=True, index=True, nullable=False
    )
    buyer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Amount charged to the buyer (exact decimal, INR rupees)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    # Payment lifecycle status
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="paymentstatus", create_constraint=True),
        nullable=False,
        default=PaymentStatus.created,
    )

    # Payment gateway / rail identifier (direct_upi, razorpay)
    provider: Mapped[str] = mapped_column(
        String(50), default="direct_upi", nullable=False
    )

    # Identifiers (populated progressively through the flow)
    provider_order_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    provider_payment_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    provider_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Direct P2PM UPI identifiers
    utr_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    seller_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Human-readable failure reason (populated on failed / refunded)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamp when payment was successfully captured / confirmed
    captured_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    order: Mapped["Order"] = relationship("Order", back_populates="payment")
    buyer: Mapped["User"] = relationship("User", foreign_keys=[buyer_id])
    seller: Mapped["User"] = relationship("User", foreign_keys=[seller_id])
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(
        "LedgerEntry", back_populates="payment"
    )
