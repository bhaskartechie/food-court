"""
Models package.

Importing this package (or any submodule) registers all ORM classes on
Base.metadata, which is required for Alembic autogenerate to detect all tables.

Usage:
    from app.db.models import User, SellerProfile, Menu, Order, Rating
    from app.db.models import Payment, LedgerEntry, Payout, Delivery
"""

from app.db.models.delivery import Delivery
from app.db.models.ledger import LedgerEntry
from app.db.models.menu import Menu
from app.db.models.order import Order
from app.db.models.payment import Payment
from app.db.models.payout import Payout
from app.db.models.rating import Rating
from app.db.models.seller import SellerProfile
from app.db.models.user import User

__all__ = [
    "Delivery",
    "LedgerEntry",
    "Menu",
    "Order",
    "Payment",
    "Payout",
    "Rating",
    "SellerProfile",
    "User",
]

