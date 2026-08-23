"""User model — buyers, sellers, and admins share this table (role-based)."""

import re
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import UserRole, VerificationStatus

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.seller import SellerProfile


class User(TimestampMixin, Base):
    """
    Represents any platform participant: buyer, seller, or admin.

    A user can hold both buyer and seller roles simultaneously — a buyer
    registers a SellerProfile to begin selling, while still placing orders.
    """

    __tablename__ = "users"

    # ── Primary Key ───────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    # Mandatory — displayed in UI
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Primary login identifier — must be unique
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # 10-digit Indian mobile — optional, validated
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)

    # Society flat number e.g. "A-101", "M2005-B03" — optional
    flat_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    # ── Role & Status ─────────────────────────────────────────────────────────
    # Roles: buyer | seller | admin | tester | developer | maintainer
    # Constraint: UI shows only buyer and seller to end-users
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole", create_constraint=True),
        nullable=False,
        default=UserRole.buyer,
    )

    # 3-state verification — pending | verified | rejected
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(VerificationStatus, name="verificationstatus", create_constraint=True),
        nullable=False,
        default=VerificationStatus.pending,
    )

    # Account active / inactive flag
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Authentication ────────────────────────────────────────────────────────
    # Bcrypt-hashed password for JWT login
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── OTP Fields (nullable — reserved for future email / phone OTP flow) ────
    # Retained so a future OTP implementation requires no schema migration.
    # When OTP is implemented, store a bcrypt hash of the OTP (not the raw code).
    otp_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    otp_attempts: Mapped[int] = mapped_column(default=0, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    seller_profile: Mapped[Optional["SellerProfile"]] = relationship(
        "SellerProfile", back_populates="user", uselist=False
    )
    orders_as_buyer: Mapped[list["Order"]] = relationship(
        "Order", back_populates="buyer", foreign_keys="Order.buyer_id"
    )
    orders_as_seller: Mapped[list["Order"]] = relationship(
        "Order", back_populates="seller", foreign_keys="Order.seller_id"
    )

    # ── Convenience Property (backward compatibility) ─────────────────────────
    @property
    def is_verified(self) -> bool:
        """True when verification_status is 'verified'. Read-only shortcut."""
        return self.verification_status == VerificationStatus.verified

    # ── Validators ────────────────────────────────────────────────────────────

    @validates("phone")
    def validate_phone(self, key: str, value: str | None) -> str | None:
        """Accept exactly 10 digits (Indian mobile numbers)."""
        if value is not None and not re.fullmatch(r"\d{10}", value):
            raise ValueError("Phone must be exactly 10 digits (e.g. 9876543210)")
        return value

    @validates("flat_number")
    def validate_flat_number(self, key: str, value: str | None) -> str | None:
        """Accept alphanumeric flat numbers with optional hyphens (e.g. A-101)."""
        if value is not None and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-]*", value):
            raise ValueError(
                "Flat number must be alphanumeric with optional hyphens (e.g. A-101)"
            )
        return value

    @validates("name")
    def validate_name(self, key: str, value: str) -> str:
        """Name must be non-empty after stripping whitespace."""
        if not value or not value.strip():
            raise ValueError("Name must not be empty")
        return value.strip()
