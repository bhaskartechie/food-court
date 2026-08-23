"""
SQLAlchemy declarative base and reusable mixins.

All ORM models inherit from Base defined here.
This module is also imported by Alembic's migrations/env.py so that
Base.metadata contains every table for autogenerate to work correctly.

Mixins:
  TimestampMixin — adds timezone-aware created_at / updated_at to any model
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    """Timezone-aware UTC now. Replaces the deprecated datetime.utcnow()."""
    return datetime.now(UTC)


class TimestampMixin:
    """
    Mixin that adds timezone-aware created_at and updated_at columns.

    Usage:
        class MyModel(TimestampMixin, Base):
            __tablename__ = "my_table"
            ...
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )


class Base(DeclarativeBase):
    """Project-wide SQLAlchemy declarative base."""

    pass
