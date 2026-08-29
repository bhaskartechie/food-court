"""Tests for delivery endpoints."""

from fastapi.testclient import TestClient

def test_get_my_deliveries_as_buyer(client: TestClient, buyer_headers: dict):
    # Only seller or admin can list their deliveries
    response = client.get("/api/v1/deliveries/me", headers=buyer_headers)
    assert response.status_code == 403

def test_get_my_deliveries_as_seller(client: TestClient, db):
    from app.core.security import create_access_token
    from app.db.models import User, SellerProfile
    from app.db.models.enums import UserRole, ApprovalStatus

    seller_user = User(name="Delivery Chef", email="delivchef@test.com", role=UserRole.seller, is_active=True)
    db.add(seller_user)
    db.commit()
    seller_prof = SellerProfile(id=seller_user.id, bio="Chef", approval_status=ApprovalStatus.approved)
    db.add(seller_prof)
    db.commit()

    token = create_access_token(seller_user.id, "seller")
    response = client.get("/api/v1/deliveries/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "deliveries" in response.json()

