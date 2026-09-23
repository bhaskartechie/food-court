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
        "items": [{"menu_id": item.id, "name": "Paneer Tikka", "quantity": 2, "price": 150.0}],
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


def test_self_order_blocked(client: TestClient, test_buyer: User, buyer_headers: dict, db: Session):
    """Test that a user cannot place an order to their own kitchen (buyer_id == seller_id)."""
    # Create menu item belonging to this buyer's ID
    item = Menu(seller_id=test_buyer.id, name="Self Dish", category="veg", price=100.0, is_available=True, quantity=5)
    db.add(item)
    db.commit()

    payload = {
        "seller_id": test_buyer.id,
        "items": [{"menu_id": item.id, "name": "Self Dish", "quantity": 1, "price": 100.0}],
    }
    response = client.post("/api/v1/orders/", json=payload, headers=buyer_headers)
    assert response.status_code == 400
    assert "cannot place orders from their own kitchen" in response.json()["detail"].lower()


def test_order_portion_decrement_and_auto_disable(client: TestClient, buyer_headers: dict, db: Session):
    """Test that placing an order decrements portion stock and auto-marks out of stock at 0."""
    seller = User(name="Portion Chef", email="portionchef@test.com", role=UserRole.seller, is_active=True)
    db.add(seller)
    db.commit()

    item = Menu(seller_id=seller.id, name="Limited Biryani", category="non-veg", price=200.0, is_available=True, quantity=2)
    db.add(item)
    db.commit()

    payload = {
        "seller_id": seller.id,
        "items": [{"menu_id": item.id, "name": "Limited Biryani", "quantity": 2, "price": 200.0}],
    }
    res = client.post("/api/v1/orders/", json=payload, headers=buyer_headers)
    assert res.status_code == 201

    db.refresh(item)
    assert item.quantity == 0
    assert item.is_available is False


def test_order_bola_unauthorized_access_blocked(client: TestClient, buyer_headers: dict, db: Session):
    """Test that resident A cannot view resident B's order details (BOLA / IDOR protection)."""
    from app.core.security import create_access_token
    # Create an order belonging to other_buyer
    other_buyer = User(name="Other Buyer", email="otherbuyer@test.com", role=UserRole.buyer, is_active=True)
    seller = User(name="Chef Rajesh", email="chefrax@test.com", role=UserRole.seller, is_active=True)
    db.add_all([other_buyer, seller])
    db.commit()

    menu_item = Menu(seller_id=seller.id, name="Paneer Tikka", category="veg", price=150.0, is_available=True)
    db.add(menu_item)
    db.commit()

    other_token = create_access_token(other_buyer.id, other_buyer.role)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    payload = {
        "seller_id": seller.id,
        "items": [{"menu_id": menu_item.id, "name": "Paneer Tikka", "quantity": 1, "price": 150.0}],
    }
    create_res = client.post("/api/v1/orders/", json=payload, headers=other_headers)
    assert create_res.status_code == 201
    order_id = create_res.json()["id"]

    # Now attempt to access this order using test_buyer's credentials (buyer_headers)
    unauth_res = client.get(f"/api/v1/orders/{order_id}", headers=buyer_headers)
    assert unauth_res.status_code == 403
    assert "do not have permission" in unauth_res.json()["detail"].lower()


def test_cart_price_concurrency_guard(client: TestClient, buyer_headers: dict, db: Session):
    """Test that checking out with a stale cart price is rejected when chef has edited dish price."""
    seller = User(name="Chef Concurrency", email="chefconc@test.com", role=UserRole.seller, is_active=True)
    db.add(seller)
    db.commit()

    item = Menu(seller_id=seller.id, name="Dum Biryani", category="non-veg", price=200.0, is_available=True, quantity=10)
    db.add(item)
    db.commit()

    # Chef updates the price to ₹240.0
    item.price = 240.0
    db.commit()

    # Buyer checkout request has stale cart price ₹200.0
    stale_payload = {
        "seller_id": seller.id,
        "items": [{"menu_id": item.id, "name": "Dum Biryani", "quantity": 1, "price": 200.0}],
    }
    res = client.post("/api/v1/orders/", json=stale_payload, headers=buyer_headers)
    assert res.status_code == 400
    assert "has been updated by the chef" in res.json()["detail"]
    assert "200.00" in res.json()["detail"]
    assert "240.00" in res.json()["detail"]


def test_menu_item_spice_level_and_edit(client: TestClient, test_seller: User, seller_headers: dict, db: Session):
    """Test creating and updating a menu item with custom spice level."""
    from app.db.models import SellerProfile
    prof = db.query(SellerProfile).filter(SellerProfile.id == test_seller.id).first()
    if not prof:
        prof = SellerProfile(id=test_seller.id, is_open=True)
        db.add(prof)
        db.commit()

    # 1. Create with spice_level='hot'
    create_payload = {
        "name": "Fiery Kolhapuri Chicken",
        "category": "non-veg",
        "price": 250.0,
        "spice_level": "hot",
        "quantity": 10,
    }
    create_res = client.post("/api/v1/menus/", json=create_payload, headers=seller_headers)
    assert create_res.status_code == 201
    menu_id = create_res.json()["id"]

    # Verify spice_level in get_seller_menus
    get_res = client.get(f"/api/v1/menus/sellers/{test_seller.id}")
    assert get_res.status_code == 200
    items = get_res.json()["items"]
    created_item = next(it for it in items if it["id"] == menu_id)
    assert created_item["spice_level"] == "hot"

    # 2. Update to spice_level='mild'
    update_payload = {
        "name": "Mild Kolhapuri Chicken",
        "price": 260.0,
        "spice_level": "mild",
        "quantity": 8,
    }
    update_res = client.put(f"/api/v1/menus/{menu_id}", json=update_payload, headers=seller_headers)
    assert update_res.status_code == 200

    # Verify updated spice_level
    get_res_updated = client.get(f"/api/v1/menus/sellers/{test_seller.id}")
    updated_item = next(it for it in get_res_updated.json()["items"] if it["id"] == menu_id)
    assert updated_item["name"] == "Mild Kolhapuri Chicken"
    assert updated_item["price"] == 260.0
    assert updated_item["spice_level"] == "mild"



