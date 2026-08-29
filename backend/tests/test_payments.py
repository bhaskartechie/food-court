"""Tests for payment endpoints."""

from fastapi.testclient import TestClient
from app.db.models import User

def test_ledger_route(client: TestClient, test_buyer: User):
    # test_buyer has role=buyer, so they shouldn't access ledger
    from app.core.security import create_access_token
    token = create_access_token(test_buyer.id, "buyer")
    response = client.get("/api/v1/payments/ledger/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_balance_route(client: TestClient, db):
    from app.core.security import create_access_token
    from app.db.models import User, SellerProfile
    from app.db.models.enums import UserRole, ApprovalStatus

    seller_user = User(name="Payment Chef", email="paychef@test.com", role=UserRole.seller, is_active=True)
    db.add(seller_user)
    db.commit()
    seller_prof = SellerProfile(id=seller_user.id, bio="Chef", approval_status=ApprovalStatus.approved)
    db.add(seller_prof)
    db.commit()

    token = create_access_token(seller_user.id, "seller")
    response = client.get("/api/v1/payments/balance/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "balance" in response.json()


