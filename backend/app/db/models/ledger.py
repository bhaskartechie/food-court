"""LedgerEntry model — double-entry accounting for seller balances."""

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.models.enums import LedgerEntryType

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.payment import Payment
    from app.db.models.user import User


class LedgerEntry(TimestampMixin, Base):
    """
    Single accounting entry in the seller's virtual ledger.

    Each captured payment creates two entries:
      - credit:        amount credited to seller (total_price - platform_fee)
      - platform_fee:  fee deducted for the platform (negative amount)

    Each refund creates:
      - refund:        amount deducted from seller balance (negative amount)
    """

    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Payment that triggered this ledger entry (nullable for direct platform adjustments / top-ups)
    payment_id: Mapped[int | None] = mapped_column(
        ForeignKey("payments.id"), index=True, nullable=True
    )

    # The user (seller) whose balance this entry affects
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # The related order (nullable for general maintenance top-ups)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id"), index=True, nullable=True
    )

    # Type of accounting entry
    entry_type: Mapped[LedgerEntryType] = mapped_column(
        SAEnum(LedgerEntryType, name="ledgerentrytype", create_constraint=True),
        nullable=False,
    )

    # Positive for credits; negative for debits / fees / refunds
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Running balance of the seller after this entry
    balance_after: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Human-readable description
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    payment: Mapped["Payment"] = relationship(
        "Payment", back_populates="ledger_entries"
    )
    user: Mapped["User"] = relationship("User")
    order: Mapped["Order"] = relationship("Order")
