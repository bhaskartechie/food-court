"""
Base module for Alembic autogenerate support.

This file imports Base AND all models so that Alembic's env.py can reference
Base.metadata and discover all tables for migration generation.

IMPORTANT: Any new model added to db/models.py must also be reflected here
via the wildcard import from db.models — they are already auto-discovered
because models.py defines them on Base.
"""

from db.models import Base  # noqa: F401 — Base.metadata used by Alembic

# Import all model classes so SQLAlchemy registers them on Base.metadata.
# Even though we don't use them directly here, the import is necessary for
# Alembic autogenerate to detect the tables.
from db.models import (  # noqa: F401
    User,
    SellerProfile,
    Menu,
    Order,
    Rating,
)
