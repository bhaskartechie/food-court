"""Order model — a purchase placed by a buyer from a seller."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import OrderStatus

if TYPE_CHECKING:
    from app.db.models.payment import Payment
    from app.db.models.user import User


class Order(TimestampMixin, Base):
    """
    Represents an order placed by a buyer.

    `items` is a JSON column containing an array of order line items:
      [{"menu_id": 1, "name": "Dal", "quantity": 2, "price": 80.0}, ...]
    """

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    buyer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Lifecycle: pending → accepted → ready → completed | cancelled
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="orderstatus", create_constraint=True),
        nullable=False,
        default=OrderStatus.pending,
    )

    # JSON array of order line items (stored natively in PostgreSQL)
    items: Mapped[Any] = mapped_column(JSON, nullable=False)

    # Exact decimal total (2dp precision)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Optional buyer note to the seller
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set when status transitions to 'completed'
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    buyer: Mapped["User"] = relationship(
        "User", back_populates="orders_as_buyer", foreign_keys=[buyer_id]
    )
    seller: Mapped["User"] = relationship(
        "User", back_populates="orders_as_seller", foreign_keys=[seller_id]
    )
    payment: Mapped[Optional["Payment"]] = relationship(
        "Payment", back_populates="order", uselist=False
    )

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("total_price")
    def validate_total_price(self, key: str, value) -> Decimal:
        """Total price must be positive."""
        val = Decimal(str(value))
        if val <= 0:
            raise ValueError("Order total_price must be greater than zero")
        return val
