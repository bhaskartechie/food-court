"""Tests for pre-orders configuration and placement."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import SellerProfile, User
from app.db.models.enums import ApprovalStatus, UserRole


def test_create_preorder_menu_and_place_preorder(client: TestClient, db: Session, test_buyer: User, buyer_headers: dict):
    # 1. Setup seller
    seller_user = User(
        name="Chef Sharma",
        email="chefsharma@test.com",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()
    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="North Indian Specials",
        approval_status=ApprovalStatus.approved,
    )
    db.add(seller_prof)
    db.commit()

    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # 2. Chef creates Pre-Order Item
    menu_res = client.post(
        "/api/v1/menus/",
        headers=seller_headers,
        json={
            "name": "Dal Makhani & Butter Naan Combo",
            "description": "Slow cooked black lentils for tonight's dinner",
            "category": "veg",
            "price": 180.0,
            "is_preorder_only": True,
            "preorder_cutoff_time": "17:00",
            "available_slots": ["dinner_today", "dinner_tomorrow"],
            "max_batch_quantity": 25,
            "min_lead_time_hours": 3,
        },
    )
    assert menu_res.status_code == 201
    menu_data = menu_res.json()
    menu_id = menu_data["id"]

    # 3. Buyer fetches seller menu and verifies pre-order fields
    menu_list_res = client.get(f"/api/v1/menus/sellers/{seller_user.id}")
    assert menu_list_res.status_code == 200
    items = menu_list_res.json()["items"]
    combo_item = next(i for i in items if i["id"] == menu_id)
    assert combo_item["is_preorder_only"] is True
    assert combo_item["preorder_cutoff_time"] == "17:00"
    assert "dinner_today" in combo_item["available_slots"]

    # 4. Buyer places a scheduled Pre-Order
    order_res = client.post(
        "/api/v1/orders/",
        headers=buyer_headers,
        json={
            "seller_id": seller_user.id,
            "items": [{"menu_id": menu_id, "name": combo_item["name"], "quantity": 2, "price": 180.0}],
            "notes": "Please deliver hot at 8 PM",
            "is_preorder": True,
            "delivery_slot": "dinner_today",
            "target_delivery_date": "2026-08-30",
            "delivery_type": "doorstep",
        },
    )
    assert order_res.status_code == 201
    order_data = order_res.json()
    assert order_data["is_preorder"] is True
    assert order_data["delivery_slot"] == "dinner_today"
    assert order_data["delivery_type"] == "doorstep"
    assert order_data["total_price"] == 360.0
