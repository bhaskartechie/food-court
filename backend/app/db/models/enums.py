"""
Central enum definitions for the Society Food Platform.

Using Python str+enum ensures:
  - String values stored in PostgreSQL native enum type
  - JSON serialisation works naturally (values are plain strings)
  - Comparison with raw string literals works (str subclass)
"""

import enum


class UserRole(str, enum.Enum):
    """Platform participant roles. UI exposes only buyer / seller."""

    buyer = "buyer"
    seller = "seller"
    admin = "admin"
    tester = "tester"
    developer = "developer"
    maintainer = "maintainer"


class VerificationStatus(str, enum.Enum):
    """3-state email / identity verification for a user account."""

    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class OrderStatus(str, enum.Enum):
    """Lifecycle states for a buyer order."""

    pending = "pending"
    accepted = "accepted"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


class MenuCategory(str, enum.Enum):
    """Food item category for a seller's menu item."""

    veg = "veg"
    non_veg = "non-veg"  # stored value is "non-veg" for backward compat
    snacks = "snacks"
    desserts = "desserts"
    beverages = "beverages"
    other = "other"


class ApprovalStatus(str, enum.Enum):
    """Admin approval state for a seller profile."""

    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PaymentStatus(str, enum.Enum):
    """Razorpay payment lifecycle states."""

    created = "created"  # Razorpay order created; awaiting payment
    captured = "captured"  # Payment captured successfully
    failed = "failed"  # Payment failed
    refunded = "refunded"  # Full refund processed


class LedgerEntryType(str, enum.Enum):
    """Type of accounting entry in the seller ledger."""

    credit = "credit"  # Sale revenue credited to seller
    debit = "debit"  # Deduction (e.g., reversal)
    platform_fee = "platform_fee"  # Platform commission deducted
    refund = "refund"  # Refund deducted from seller balance


class PayoutStatus(str, enum.Enum):
    """Payout transfer states."""

    pending = "pending"
    processing = "processing"
    paid = "paid"
    failed = "failed"


class DeliveryStatus(str, enum.Enum):
    """In-building delivery lifecycle states (Option A — seller carries to buyer's door)."""

    pending = "pending"        # Delivery record created; seller hasn't left yet
    dispatched = "dispatched"  # Seller has picked up the food and is en route
    delivered = "delivered"    # Food handed to buyer at their door
    failed = "failed"          # Delivery could not be completed


class DeliverySlot(str, enum.Enum):
    """Scheduled delivery / pickup slots for pre-orders."""

    lunch_today = "lunch_today"          # 12:30 PM – 1:30 PM Today
    dinner_today = "dinner_today"        # 7:30 PM – 8:30 PM Today
    lunch_tomorrow = "lunch_tomorrow"    # 12:30 PM – 1:30 PM Tomorrow
    dinner_tomorrow = "dinner_tomorrow"  # 7:30 PM – 8:30 PM Tomorrow
    weekend_special = "weekend_special"  # Saturday / Sunday Special Batch
    custom = "custom"


class DeliveryType(str, enum.Enum):
    """Fulfillment method chosen by the buyer."""

    doorstep = "doorstep"      # In-building delivery to buyer's flat
    self_pickup = "self_pickup"  # Buyer picks up from seller's flat


class SuggestionStatus(str, enum.Enum):
    """Lifecycle status for community dish suggestions."""

    open = "open"                      # Active for community upvotes
    claimed_by_chef = "claimed_by_chef"  # Chef agreed to cook; pre-order opened
    fulfilled = "fulfilled"            # Batch completed
    closed = "closed"                  # Expired or closed

