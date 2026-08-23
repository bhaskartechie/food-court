"""
Database seed script — populates the dev DB with realistic fake data.

Usage (from the backend/ directory):
    python scripts/seed_faker.py

What it creates:
  - 1 admin user
  - N buyer users (some inactive, unverified)
  - N seller users (some pending approval, rejected, closed)
  - M menu items per seller (varying quantities, out of stock)
  - K orders per buyer (all statuses)
  - Payment, LedgerEntry, Payout records (including refunds)
  - Delivery records for ready/completed orders
  - Ratings for completed orders

All seed users share the password:  SocietyFood@2025
(logged at the end of the script for convenience)
"""

import os
import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

# Allow running from any working directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from faker import Faker
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import (
    Delivery,
    LedgerEntry,
    Menu,
    Order,
    Payment,
    Payout,
    Rating,
    SellerProfile,
    User,
)
from app.db.models.enums import (
    ApprovalStatus,
    DeliveryStatus,
    LedgerEntryType,
    MenuCategory,
    OrderStatus,
    PaymentStatus,
    PayoutStatus,
    UserRole,
    VerificationStatus,
)
from app.db.session import SessionLocal, engine

# Using the Indian locale for Indian names, addresses, etc.
fake = Faker("en_IN")

# ── Configuration ─────────────────────────────────────────────────────────────
SEED_PASSWORD = "SocietyFood@2025"
NUM_BUYERS = 30
NUM_SELLERS = 10
MENUS_PER_SELLER = 8
ORDERS_PER_BUYER = 4
PLATFORM_FEE_PERCENT = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / 100

# Hyderabad-specific society flat number formats (alphanumeric and hyphens only)
FLAT_FORMATS = [
    lambda: f"TowerA-{random.randint(1, 20)}0{random.randint(1, 9)}",
    lambda: f"BlockB-{random.randint(1, 20)}0{random.randint(1, 9)}",
    lambda: f"MHB-T{random.randint(1, 5)}-{random.randint(1, 30)}0{random.randint(1, 9)}", # MHB = My Home Bhooja
    lambda: f"AS-C{random.randint(1, 10)}-{random.randint(1, 15)}0{random.randint(1, 9)}",   # AS = Aparna Sarovar
    lambda: f"LH-T{random.randint(1, 10)}-{random.randint(100, 2500)}",                    # LH = Lanco Hills
]

# Hyderabad/Indian localized content
HYD_BIOS = [
    "Authentic Hyderabadi home-cooked meals.",
    "Specializing in spicy Andhra meals and authentic biryanis.",
    "Pure veg Jain and South Indian meals made with love.",
    "Telangana delicacies, just like grandma used to make.",
    "Healthy, less oil home-style food delivered hot.",
    "Nizam's royal recipes cooked in a hygienic home kitchen.",
]

ORDER_NOTES = [
    "Please make it extra spicy!",
    "Send extra raita and salan.",
    "Less oil please, healthy diet.",
    "Please pack it carefully, don't spill the gravy.",
    "Ring the bell once and leave at the door."
]

DELIVERY_NOTES = [
    "Left at the door as requested.",
    "Handed over to the security guard.",
    "Arriving in 5 mins.",
    "Please collect from the lobby."
]

REVIEW_TEXTS = {
    5: ["Excellent biryani, exactly like home!", "Superb taste and very hygienic.", "Best home-cooked food in our society.", "Mirchi ka salan was amazing!"],
    4: ["Very authentic taste, but slightly late delivery.", "Good food, will order again.", "Tasty and neat packaging."],
    3: ["A bit too spicy for me, but okay.", "Portion size could be better.", "Average taste, nothing special."],
    2: ["Food was cold by the time it arrived.", "Too much oil in the curry.", "Did not like the taste much."],
    1: ["Very disappointing.", "Completely tasteless, waste of money.", "Received the wrong item!"]
}


def _utcnow() -> datetime:
    return datetime.now(UTC)

def _past(days: int, hours: int = 0, minutes: int = 0) -> datetime:
    return _utcnow() - timedelta(days=days, hours=hours, minutes=minutes)

def _phone() -> str:
    """Random 10-digit Indian mobile number."""
    return f"{random.choice([6, 7, 8, 9])}{random.randint(100000000, 999999999)}"

def _flat() -> str:
    return random.choice(FLAT_FORMATS)()

def _menu_category() -> MenuCategory:
    return random.choice(list(MenuCategory))

def _menu_items_for_category(category: MenuCategory) -> list[str]:
    # Hyderabad / South Indian focused menu items
    items = {
        MenuCategory.veg: ["Bagara Baingan", "Paneer Butter Masala", "Gutti Vankaya Kura", "Pesarattu Upma", "Pappu Charu", "Vegetable Dum Biryani"],
        MenuCategory.non_veg: ["Hyderabadi Chicken Dum Biryani", "Mutton Haleem", "Gongura Mamsam", "Natukodi Pulusu", "Talakaya Kura", "Chicken 65"],
        MenuCategory.snacks: ["Mirchi Bajji", "Punugulu", "Osmania Biscuits", "Samosa", "Onion Pakoda"],
        MenuCategory.desserts: ["Double ka Meetha", "Qubani ka Meetha", "Kaddu ki Kheer", "Junnu", "Jalebi"],
        MenuCategory.beverages: ["Irani Chai", "Sweet Lassi", "Rooh Afza", "Fresh Lime Soda", "Filter Coffee"],
        MenuCategory.other: ["Roti (2 pcs)", "Rumali Roti", "Bagara Rice", "Mirchi ka Salan", "Raita"],
    }
    return items.get(category, ["Special Item"])

def _price_for_category(category: MenuCategory) -> Decimal:
    ranges = {
        MenuCategory.veg: (60, 180),
        MenuCategory.non_veg: (150, 350),
        MenuCategory.snacks: (30, 80),
        MenuCategory.desserts: (50, 150),
        MenuCategory.beverages: (20, 60),
        MenuCategory.other: (20, 60),
    }
    lo, hi = ranges.get(category, (50, 150))
    return Decimal(str(random.randrange(lo, hi, 5)))

def create_tables() -> None:
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    print("✓ Tables verified / created")

def seed_admin(db: Session) -> User:
    existing = db.query(User).filter(User.email == "admin@societyfood.local").first()
    if existing:
        print("  admin already exists — skipping")
        return existing

    admin = User(
        name="Aditya Reddy",  # Localized admin name
        email="admin@societyfood.local",
        phone=_phone(),
        flat_number="ADMIN-001",
        role=UserRole.admin,
        verification_status=VerificationStatus.verified,
        is_active=True,
        hashed_password=hash_password(SEED_PASSWORD),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"  ✓ Admin: {admin.email}")
    return admin

def seed_buyers(db: Session, n: int) -> list[User]:
    buyers = []
    for i in range(n):
        email = f"buyer{i + 1}@societyfood.local"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            buyers.append(existing)
            continue

        # Corner cases: some buyers inactive or pending verification
        is_active = random.random() > 0.1
        v_status = VerificationStatus.verified if random.random() > 0.1 else VerificationStatus.pending

        user = User(
            name=fake.name(),  # Uses en_IN locale for Indian names
            email=email,
            phone=_phone(),
            flat_number=_flat(),
            role=UserRole.buyer,
            verification_status=v_status,
            is_active=is_active,
            hashed_password=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        buyers.append(user)

    db.commit()
    print(f"  ✓ {len(buyers)} buyers seeded")
    return buyers

def seed_sellers(db: Session, n: int) -> list[tuple[User, SellerProfile]]:
    seller_pairs = []

    for i in range(n):
        email = f"seller{i + 1}@societyfood.local"
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            existing_profile = db.query(SellerProfile).filter(SellerProfile.id == existing_user.id).first()
            if existing_profile:
                seller_pairs.append((existing_user, existing_profile))
                continue

        # Vary seller statuses
        approval_status = random.choices(
            list(ApprovalStatus), weights=[70, 20, 10]  # mostly approved, some pending, some rejected
        )[0]
        
        # Some are closed
        is_open = random.random() > 0.2 if approval_status == ApprovalStatus.approved else False

        user = User(
            name=fake.name(),
            email=email,
            phone=_phone(),
            flat_number=_flat(),
            role=UserRole.seller,
            verification_status=VerificationStatus.verified,
            is_active=True,
            hashed_password=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        db.flush()

        profile = SellerProfile(
            id=user.id,
            bio=random.choice(HYD_BIOS),
            upi_id=f"seller{i + 1}@paytm",
            bank_account=f"9{random.randint(10000000000, 99999999999)}",
            photo_url=f"https://picsum.photos/seed/seller{i + 1}/200",
            approval_status=approval_status,
            is_open=is_open,
            rating=0.0,
            review_count=0,
        )
        db.add(profile)
        seller_pairs.append((user, profile))

    db.commit()
    print(f"  ✓ {len(seller_pairs)} sellers seeded")
    return seller_pairs

def seed_menus(db: Session, seller_pairs: list[tuple[User, SellerProfile]], per_seller: int) -> list[Menu]:
    all_items = []
    for user, profile in seller_pairs:
        existing = db.query(Menu).filter(Menu.seller_id == profile.id).count()
        if existing >= per_seller:
            all_items.extend(db.query(Menu).filter(Menu.seller_id == profile.id).all())
            continue

        for _ in range(per_seller):
            cat = _menu_category()
            name_pool = _menu_items_for_category(cat)
            
            # Corner cases: zero quantity, low quantity, unavailable
            quantity = random.choices([0, 1, 2, 5, 10, 20, 100], weights=[10, 10, 10, 20, 20, 20, 10])[0]
            is_available = quantity > 0 and random.random() > 0.1
            
            item = Menu(
                seller_id=profile.id,
                name=random.choice(name_pool),
                description=random.choice(["Freshly prepared every day.", "Cooked with cold-pressed oils.", "Spicy and tangy.", "Mildly spiced, good for kids.", "Authentic local recipe."]),
                category=cat,
                price=_price_for_category(cat),
                is_available=is_available,
                quantity=quantity,
                image_url=f"https://picsum.photos/seed/menu{random.randint(1, 1000)}/300/200",
            )
            db.add(item)
            all_items.append(item)

    db.commit()
    print(f"  ✓ {len(all_items)} menu items seeded")
    return all_items

def seed_orders_payments_deliveries(
    db: Session,
    buyers: list[User],
    seller_pairs: list[tuple[User, SellerProfile]],
    menus: list[Menu],
    orders_per_buyer: int,
) -> None:
    created_orders = 0
    created_payments = 0
    created_deliveries = 0

    menu_by_seller: dict[int, list[Menu]] = {}
    for m in menus:
        menu_by_seller.setdefault(m.seller_id, []).append(m)

    for buyer in buyers:
        if not buyer.is_active:
            continue
            
        for _ in range(orders_per_buyer):
            # Only order from approved sellers
            approved_sellers = [sp for sp in seller_pairs if sp[1].approval_status == ApprovalStatus.approved]
            if not approved_sellers:
                break
                
            seller_user, seller_profile = random.choice(approved_sellers)
            seller_menus = menu_by_seller.get(seller_profile.id, [])
            if not seller_menus:
                continue

            selected = random.sample(seller_menus, min(random.randint(1, 3), len(seller_menus)))
            items_data = []
            total = Decimal("0.00")
            for item in selected:
                qty = random.randint(1, 3)
                items_data.append(
                    {
                        "menu_id": item.id,
                        "name": item.name,
                        "quantity": qty,
                        "price": float(item.price),
                    }
                )
                total += Decimal(str(item.price)) * qty

            status = random.choices(
                list(OrderStatus), weights=[10, 10, 10, 50, 20] # more completed/cancelled
            )[0]

            created_at = _past(random.randint(1, 60), random.randint(0, 23))
            completed_at = created_at + timedelta(minutes=random.randint(30, 120)) if status == OrderStatus.completed else None

            order = Order(
                buyer_id=buyer.id,
                seller_id=seller_user.id,
                status=status,
                items=items_data,
                total_price=total,
                notes=random.choice(ORDER_NOTES) if random.random() > 0.7 else None,
                completed_at=completed_at,
                created_at=created_at,
                updated_at=completed_at or created_at,
            )
            db.add(order)
            db.flush()
            created_orders += 1

            # Payment / Refund Handling
            if status in (OrderStatus.completed, OrderStatus.cancelled, OrderStatus.ready, OrderStatus.accepted):
                payment_status = PaymentStatus.captured
                if status == OrderStatus.cancelled and random.random() > 0.5:
                    payment_status = PaymentStatus.refunded
                
                payment = Payment(
                    order_id=order.id,
                    buyer_id=buyer.id,
                    seller_id=seller_user.id,
                    amount=total,
                    currency="INR",
                    status=payment_status,
                    provider="razorpay",
                    provider_order_id=f"order_{fake.uuid4()[:20]}",
                    provider_payment_id=f"pay_{fake.uuid4()[:20]}",
                    captured_at=created_at + timedelta(minutes=1),
                    created_at=created_at,
                )
                db.add(payment)
                db.flush()
                created_payments += 1

                # Ledger for completed
                if payment_status == PaymentStatus.captured and status == OrderStatus.completed:
                    platform_fee = (total * PLATFORM_FEE_PERCENT).quantize(Decimal("0.01"))
                    seller_credit = total - platform_fee
                    approx_balance = Decimal(str(random.uniform(100, 5000))).quantize(Decimal("0.01"))

                    db.add(LedgerEntry(
                        payment_id=payment.id,
                        user_id=seller_user.id,
                        order_id=order.id,
                        entry_type=LedgerEntryType.credit,
                        amount=seller_credit,
                        balance_after=approx_balance + seller_credit,
                        description=f"Sale credit for order #{order.id}",
                        created_at=completed_at,
                    ))
                    db.add(LedgerEntry(
                        payment_id=payment.id,
                        user_id=seller_user.id,
                        order_id=order.id,
                        entry_type=LedgerEntryType.platform_fee,
                        amount=-platform_fee,
                        balance_after=approx_balance,
                        description=f"Platform fee for order #{order.id}",
                        created_at=completed_at,
                    ))

            # Delivery tracking (only for ready/completed)
            if status in (OrderStatus.ready, OrderStatus.completed):
                # 80% chance it has a delivery record if completed
                if status == OrderStatus.completed and random.random() < 0.8:
                    delivery_status = DeliveryStatus.delivered
                    if random.random() > 0.9:
                        delivery_status = DeliveryStatus.failed
                elif status == OrderStatus.ready:
                    delivery_status = random.choice([DeliveryStatus.pending, DeliveryStatus.dispatched])
                else:
                    delivery_status = None
                
                if delivery_status:
                    db.add(Delivery(
                        order_id=order.id,
                        seller_id=seller_user.id,
                        buyer_id=buyer.id,
                        status=delivery_status,
                        seller_flat=seller_user.flat_number,
                        buyer_flat=buyer.flat_number,
                        estimated_minutes=random.randint(5, 20),
                        notes=random.choice(DELIVERY_NOTES) if random.random() > 0.5 else None,
                        dispatched_at=completed_at - timedelta(minutes=10) if completed_at else None,
                        delivered_at=completed_at if delivery_status == DeliveryStatus.delivered else None,
                        created_at=created_at + timedelta(minutes=20),
                    ))
                    created_deliveries += 1

            # Rating for completed orders
            if status == OrderStatus.completed and random.random() > 0.3:
                existing_rating = db.query(Rating).filter(Rating.order_id == order.id).first()
                if not existing_rating:
                    score = random.choices([1, 2, 3, 4, 5], weights=[1, 2, 5, 15, 20])[0]
                    db.add(Rating(
                        order_id=order.id,
                        seller_id=seller_profile.id,
                        rater_id=buyer.id,
                        score=score,
                        review_text=random.choice(REVIEW_TEXTS[score]) if random.random() > 0.5 else None,
                        created_at=completed_at + timedelta(days=random.randint(0, 2)),
                    ))

    db.commit()
    print(f"  ✓ {created_orders} orders seeded")
    print(f"  ✓ {created_payments} payments seeded")
    print(f"  ✓ {created_deliveries} deliveries seeded")

def seed_payout(db: Session, seller_pairs: list[tuple[User, SellerProfile]]) -> None:
    statuses = [PayoutStatus.paid, PayoutStatus.pending, PayoutStatus.failed]
    for i, (user, profile) in enumerate(seller_pairs):
        existing = db.query(Payout).filter(Payout.seller_id == user.id).first()
        if existing:
            continue

        payout_status = statuses[i % len(statuses)]
        db.add(Payout(
            seller_id=user.id,
            amount=Decimal(str(random.randrange(500, 5000, 50))),
            status=payout_status,
            upi_id=profile.upi_id,
            provider="razorpay",
            provider_payout_id=f"pout_{fake.uuid4()[:20]}" if payout_status == PayoutStatus.paid else None,
            failure_reason="Insufficient funds" if payout_status == PayoutStatus.failed else None,
            completed_at=_past(random.randint(1, 10)) if payout_status == PayoutStatus.paid else None,
        ))

    db.commit()
    print(f"  ✓ {len(seller_pairs)} payout records seeded")

def update_seller_aggregates(db: Session, seller_pairs: list[tuple[User, SellerProfile]]) -> None:
    for user, profile in seller_pairs:
        result = db.query(func.avg(Rating.score), func.count(Rating.id)).filter(Rating.seller_id == profile.id).first()
        avg_score, count = result if result else (None, 0)
        profile.rating = round(float(avg_score or 0), 2)
        profile.review_count = count or 0

    db.commit()
    print("  ✓ Seller rating aggregates updated")

def main() -> None:
    print("\nSociety Food Platform Seed Script")
    print("=" * 50)

    create_tables()

    db: Session = SessionLocal()
    try:
        print("\nSeeding users...")
        admin = seed_admin(db)
        buyers = seed_buyers(db, NUM_BUYERS)
        seller_pairs = seed_sellers(db, NUM_SELLERS)

        print("\nSeeding menus...")
        menus = seed_menus(db, seller_pairs, MENUS_PER_SELLER)

        print("\nSeeding orders, payments & deliveries...")
        seed_orders_payments_deliveries(db, buyers, seller_pairs, menus, ORDERS_PER_BUYER)

        print("\nSeeding payouts...")
        seed_payout(db, seller_pairs)

        print("\nUpdating seller aggregates...")
        update_seller_aggregates(db, seller_pairs)

    finally:
        db.close()

    print("\n" + "=" * 50)
    print("✅ Seed complete!")
    print(f"\nAll seed accounts use the password: {SEED_PASSWORD}")
    print("\nTest logins:")
    print("  Admin:    admin@societyfood.local")
    print("  Buyer:    buyer1@societyfood.local")
    print("  Seller:   seller1@societyfood.local")
    print("\nSwagger UI: http://localhost:8000/api/v1/docs")
    print("=" * 50)

if __name__ == "__main__":
    main()
