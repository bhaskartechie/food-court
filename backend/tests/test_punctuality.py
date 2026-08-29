"""Tests for automated punctuality and reliability rating service."""

from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User, SellerProfile, Order, Delivery
from app.db.models.enums import UserRole, ApprovalStatus, OrderStatus, DeliverySlot, DeliveryType
from app.services.punctuality_service import (
    calculate_order_is_on_time,
    update_seller_punctuality_on_order_completed,
)


def test_calculate_order_is_on_time_instant(db: Session):
    now = datetime.now(timezone.utc)
    # Order placed 20 mins ago, completed now with estimated 30 mins -> On time
    order = Order(
        buyer_id=1,
        seller_id=2,
        status=OrderStatus.completed,
        items=[],
        total_price=100.0,
        created_at=now - timedelta(minutes=20),
        completed_at=now,
        is_preorder=False,
    )
    delivery = Delivery(
        order_id=1,
        seller_id=2,
        buyer_id=1,
        estimated_minutes=30,
    )

    is_on_time, duration = calculate_order_is_on_time(order, delivery)
    assert is_on_time is True
    assert duration == 20


def test_calculate_order_is_on_time_preorder(db: Session):
    today = date.today()
    completed_time = datetime(today.year, today.month, today.day, 13, 15, tzinfo=timezone.utc)
    created_time = datetime(today.year, today.month, today.day, 9, 0, tzinfo=timezone.utc)

    order = Order(
        buyer_id=1,
        seller_id=2,
        status=OrderStatus.completed,
        items=[],
        total_price=200.0,
        created_at=created_time,
        completed_at=completed_time,
        is_preorder=True,
        delivery_slot="lunch_today",
        target_delivery_date=today,
    )

    is_on_time, duration = calculate_order_is_on_time(order, None)
    assert is_on_time is True


def test_update_seller_punctuality_flow(db: Session):
    seller_user = User(name="Punctual Chef", email="punctual@test.com", role=UserRole.seller, is_active=True)
    db.add(seller_user)
    db.commit()
    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="Fast Chef",
        approval_status=ApprovalStatus.approved,
        on_time_delivery_rate=100.0,
        punctuality_rating=5.0,
    )
    db.add(seller_prof)
    db.commit()

    now = datetime.now(timezone.utc)
    order1 = Order(
        buyer_id=1,
        seller_id=seller_user.id,
        status=OrderStatus.completed,
        items=[{"name": "Thali", "quantity": 1, "price": 120.0}],
        total_price=120.0,
        created_at=now - timedelta(minutes=25),
        completed_at=now,
        is_preorder=False,
    )
    db.add(order1)
    db.commit()

    updated_prof = update_seller_punctuality_on_order_completed(db, seller_user.id, order1)
    assert updated_prof is not None
    assert updated_prof.total_orders_completed == 1
    assert updated_prof.on_time_delivery_rate == 100.0
    assert updated_prof.punctuality_rating == 5.0

