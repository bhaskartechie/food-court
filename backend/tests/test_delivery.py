"""Tests for delivery endpoints."""

from fastapi.testclient import TestClient

def test_get_my_deliveries_as_buyer(client: TestClient, buyer_headers: dict):
    # Only seller or admin can list their deliveries
    response = client.get("/api/v1/deliveries/me", headers=buyer_headers)
    assert response.status_code == 403

def test_get_my_deliveries_as_seller(client: TestClient, test_buyer):
    from app.core.security import create_access_token
    token = create_access_token(test_buyer.id, "seller")
    response = client.get("/api/v1/deliveries/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "deliveries" in response.json()
