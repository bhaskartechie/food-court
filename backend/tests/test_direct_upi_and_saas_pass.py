"""Unit and integration tests for Direct P2PM UPI and SaaS Pass Maintenance Model."""

from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import Menu, Order, Payment, SellerProfile, User
from app.db.models.enums import ApprovalStatus, LedgerEntryType, MenuCategory, OrderStatus, PaymentStatus, UserRole


def test_direct_upi_flow_and_saas_quota(client: TestClient, db: Session):
    # 1. Create seller with UPI ID and 50 free orders
    seller_user = User(
        name="Chef Lakshmi",
        email="lakshmi@test.com",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()

    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="South Indian Home Kitchen",
        upi_id="lakshmi@oksbi",
        upi_account_name="Lakshmi Devi",
        is_upi_verified=True,
        free_orders_remaining=50,
        maintenance_balance=Decimal("0.00"),
        approval_status=ApprovalStatus.approved,
        is_open=True,
    )
    db.add(seller_prof)

    # 2. Create buyer
    buyer_user = User(
        name="Resident Ramesh",
        email="ramesh@test.com",
        role=UserRole.buyer,
        is_active=True,
    )
    db.add(buyer_user)
    db.commit()

    # 3. Create menu item
    menu = Menu(
        seller_id=seller_user.id,
        name="Idli Vada Combo",
        category=MenuCategory.veg,
        price=Decimal("120.00"),
        is_available=True,
        quantity=10,
    )
    db.add(menu)
    db.commit()

    # 4. Buyer places an order
    order = Order(
        buyer_id=buyer_user.id,
        seller_id=seller_user.id,
        total_price=Decimal("240.00"),
        status=OrderStatus.pending,
        items=[{"menu_id": menu.id, "name": "Idli Vada Combo", "quantity": 2, "price": 120.0}],
    )
    db.add(order)
    db.commit()

    buyer_token = create_access_token(buyer_user.id, "buyer")
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # 5. Buyer initiates Direct P2PM UPI payment
    res_intent = client.post(
        f"/api/v1/payments/orders/{order.id}/direct-upi",
        headers=buyer_headers,
    )
    assert res_intent.status_code == 200
    intent_data = res_intent.json()
    assert intent_data["seller_vpa"] == "lakshmi@oksbi"
    assert intent_data["seller_name"] == "Lakshmi Devi"
    assert "upi://pay?" in intent_data["upi_uri"]
    assert "pa=lakshmi%40oksbi" in intent_data["upi_uri"]
    assert "am=240.00" in intent_data["upi_uri"]

    # 6. Buyer submits 12-digit UTR
    res_utr = client.post(
        f"/api/v1/payments/orders/{order.id}/submit-utr",
        headers=buyer_headers,
        json={"utr_number": "412345678901"},
    )
    assert res_utr.status_code == 200
    payment_data = res_utr.json()
    assert payment_data["status"] == "submitted"
    assert payment_data["utr_number"] == "412345678901"

    # 7. Seller confirms receipt in Kitchen Hub
    res_confirm = client.post(
        f"/api/v1/payments/orders/{order.id}/confirm-received",
        headers=seller_headers,
    )
    assert res_confirm.status_code == 200
    confirm_data = res_confirm.json()
    assert confirm_data["status"] == "captured"

    # Order should now be accepted
    db.refresh(order)
    assert order.status == OrderStatus.accepted

    # Check SaaS Pass Quota: 50 -> 49 free orders remaining, 0 maintenance fee charged
    db.refresh(seller_prof)
    assert seller_prof.free_orders_remaining == 49
    assert seller_prof.maintenance_balance == Decimal("0.00")
    assert seller_prof.lifetime_orders_count == 1


def test_saas_pass_exhaustion_and_topup(client: TestClient, db: Session):
    # Setup seller with 0 free orders
    seller_user = User(
        name="Chef Suresh",
        email="suresh@test.com",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()

    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="Biryani Corner",
        upi_id="suresh@paytm",
        upi_account_name="Suresh Kumar",
        free_orders_remaining=0,  # Quota exhausted
        maintenance_balance=Decimal("10.00"),  # Has ₹10 balance
        approval_status=ApprovalStatus.approved,
        is_open=True,
    )
    db.add(seller_prof)

    buyer_user = User(
        name="Resident Anita",
        email="anita@test.com",
        role=UserRole.buyer,
        is_active=True,
    )
    db.add(buyer_user)
    db.commit()

    order = Order(
        buyer_id=buyer_user.id,
        seller_id=seller_user.id,
        total_price=Decimal("350.00"),
        status=OrderStatus.pending,
        items=[{"name": "Mutton Biryani", "quantity": 1, "price": 350.0}],
    )
    db.add(order)
    db.commit()

    # Create payment in submitted state
    payment = Payment(
        order_id=order.id,
        buyer_id=buyer_user.id,
        seller_id=seller_user.id,
        amount=order.total_price,
        currency="INR",
        status=PaymentStatus.submitted,
        provider="direct_upi",
        utr_number="499988877766",
    )
    db.add(payment)
    db.commit()

    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # Chef confirms order
    res_confirm = client.post(
        f"/api/v1/payments/orders/{order.id}/confirm-received",
        headers=seller_headers,
    )
    assert res_confirm.status_code == 200

    # Maintenance balance should be debited by ₹5 (₹10.00 - ₹5.00 = ₹5.00)
    db.refresh(seller_prof)
    assert seller_prof.free_orders_remaining == 0
    assert seller_prof.maintenance_balance == Decimal("5.00")

    # Check maintenance status API
    res_status = client.get("/api/v1/payments/maintenance/status", headers=seller_headers)
    assert res_status.status_code == 200
    status_json = res_status.json()
    assert status_json["free_orders_remaining"] == 0
    assert float(status_json["maintenance_balance"]) == 5.0
    assert status_json["is_availability_allowed"] is True

    # Chef tops up ₹50 via recharge UTR
    res_topup = client.post(
        "/api/v1/payments/maintenance/topup",
        headers=seller_headers,
        json={"amount": 50.0, "utr_number": "411122233344"},
    )
    assert res_topup.status_code == 200
    topup_json = res_topup.json()
    assert float(topup_json["maintenance_balance"]) == 55.0


def test_availability_toggle_guards(client: TestClient, db: Session):
    # Seller without UPI ID cannot toggle open
    seller_user = User(
        name="Chef NoUPI",
        email="noupi@test.com",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(seller_user)
    db.commit()

    seller_prof = SellerProfile(
        id=seller_user.id,
        bio="No UPI yet",
        upi_id=None,
        is_open=False,
        approval_status=ApprovalStatus.approved,
    )
    db.add(seller_prof)
    db.commit()

    seller_token = create_access_token(seller_user.id, "seller")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # Attempt to open kitchen without UPI
    res_open = client.patch("/api/v1/sellers/me/open", headers=seller_headers)
    assert res_open.status_code == 400
    assert "UPI ID" in res_open.json()["detail"]

    # Configure UPI ID
    res_update = client.put(
        "/api/v1/sellers/me",
        headers=seller_headers,
        json={"upi_id": "noupi@okaxis", "upi_account_name": "NoUPI Chef"},
    )
    assert res_update.status_code == 200

    # Now opening succeeds
    res_open2 = client.patch("/api/v1/sellers/me/open", headers=seller_headers)
    assert res_open2.status_code == 200
    assert res_open2.json()["is_open"] is True
