"""Menu model — food items offered by a seller."""

from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import MenuCategory

if TYPE_CHECKING:
    from app.db.models.seller import SellerProfile


class Menu(TimestampMixin, Base):
    """A single food item in a seller's menu."""

    __tablename__ = "menus"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # FK to seller_profiles.id — only sellers own menus
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("seller_profiles.id"), index=True, nullable=False
    )

    # Item name — mandatory, displayed in UI
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Optional description — shown below the name in UI
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Food category — dropdown in UI
    category: Mapped[MenuCategory] = mapped_column(
        SAEnum(MenuCategory, name="menucategory", create_constraint=True),
        nullable=False,
    )

    # Price stored as exact decimal (2dp) to avoid float rounding errors
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Availability toggle — seller can mark items out of stock
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional quantity (0 = unlimited); useful for limited-batch items
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Optional image URL (CDN / S3)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    seller: Mapped["SellerProfile"] = relationship(
        "SellerProfile", back_populates="menus"
    )

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("price")
    def validate_price(self, key: str, value) -> Decimal:
        """Price must be greater than zero."""
        val = Decimal(str(value))
        if val <= 0:
            raise ValueError("Price must be greater than zero")
        return val

    @validates("name")
    def validate_name(self, key: str, value: str) -> str:
        """Name must be non-empty."""
        if not value or not value.strip():
            raise ValueError("Menu item name must not be empty")
        return value.strip()

    @validates("quantity")
    def validate_quantity(self, key: str, value: int) -> int:
        """Quantity must be 0 (unlimited) or positive."""
        if int(value) < 0:
            raise ValueError("Quantity must be 0 (unlimited) or a positive integer")
        return int(value)
