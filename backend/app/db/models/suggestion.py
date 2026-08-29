"""Dish Suggestion and Upvote models — Community Cravings Marketplace."""

from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import MenuCategory, SuggestionStatus

if TYPE_CHECKING:
    from app.db.models.menu import Menu
    from app.db.models.seller import SellerProfile
    from app.db.models.user import User


class DishSuggestion(TimestampMixin, Base):
    """
    A community dish request posted by a resident buyer.
    Other residents can upvote it, and chefs can claim it to launch a pre-order batch.
    """

    __tablename__ = "dish_suggestions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Resident who posted the dish suggestion
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Suggested dish name (e.g. "Hyderabadi Dum Biryani")
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Description of what the community wants / spice level / dietary preference
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Category of dish
    category: Mapped[MenuCategory] = mapped_column(
        SAEnum(MenuCategory, name="menucategory", create_constraint=True),
        nullable=False,
        default=MenuCategory.veg,
    )

    # Target date when resident is craving it (e.g. This Sunday)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Denormalized counter of upvotes for fast sorting
    upvotes_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Status: open -> claimed_by_chef -> fulfilled | closed
    status: Mapped[SuggestionStatus] = mapped_column(
        SAEnum(SuggestionStatus, name="suggestionstatus", create_constraint=True),
        nullable=False,
        default=SuggestionStatus.open,
    )

    # Chef who claimed this request (optional)
    accepted_by_seller_id: Mapped[int | None] = mapped_column(
        ForeignKey("seller_profiles.id"), nullable=True, index=True
    )

    # Pre-order menu item created by the chef from this suggestion (optional)
    created_menu_id: Mapped[int | None] = mapped_column(
        ForeignKey("menus.id"), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    seller: Mapped[Optional["SellerProfile"]] = relationship(
        "SellerProfile", foreign_keys=[accepted_by_seller_id]
    )
    menu: Mapped[Optional["Menu"]] = relationship("Menu", foreign_keys=[created_menu_id])
    upvotes: Mapped[list["DishUpvote"]] = relationship(
        "DishUpvote", back_populates="suggestion", cascade="all, delete-orphan"
    )

    # ── Validators ────────────────────────────────────────────────────────────
    @validates("title")
    def validate_title(self, key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Dish suggestion title cannot be empty")
        return value.strip()


class DishUpvote(TimestampMixin, Base):
    """Upvote record linking a user to a dish suggestion."""

    __tablename__ = "dish_upvotes"
    __table_args__ = (
        UniqueConstraint("user_id", "suggestion_id", name="uq_user_dish_suggestion"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    suggestion_id: Mapped[int] = mapped_column(
        ForeignKey("dish_suggestions.id"), index=True, nullable=False
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User")
    suggestion: Mapped["DishSuggestion"] = relationship(
        "DishSuggestion", back_populates="upvotes"
    )
