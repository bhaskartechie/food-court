"""Tests for orders and delivery endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Menu, Order, User
from app.db.models.enums import OrderStatus, UserRole


def test_list_orders_buyer(client: TestClient, buyer_headers: dict):
    response = client.get("/api/v1/orders/", headers=buyer_headers)
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert isinstance(data["orders"], list)


def test_list_orders_seller(client: TestClient, seller_headers: dict):
    response = client.get("/api/v1/orders/", headers=seller_headers)
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert isinstance(data["orders"], list)


def test_create_and_cancel_order(client: TestClient, buyer_headers: dict, seller_headers: dict, db: Session):
    seller = User(name="Chef Test", email="cheforders@test.com", role=UserRole.seller, is_active=True)
    db.add(seller)
    db.commit()

    item = Menu(seller_id=seller.id, name="Paneer Tikka", category="veg", price=150.0, is_available=True, quantity=10)
    db.add(item)
    db.commit()

    # Place order
    payload = {
        "seller_id": seller.id,
        "items": [{"menu_id": item.id, "quantity": 2}],
        "delivery_type": "doorstep",
        "notes": "Spicy please",
    }
    create_res = client.post("/api/v1/orders/", json=payload, headers=buyer_headers)
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    # Cancel order
    cancel_res = client.delete(f"/api/v1/orders/{order_id}", headers=buyer_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


def test_delivery_route_loads(client: TestClient, buyer_headers: dict):
    # Buyer checks delivery for an invalid order, should get 404 cleanly
    response = client.get("/api/v1/deliveries/orders/999", headers=buyer_headers)
    assert response.status_code == 404

