"""Tests for payment endpoints."""

from fastapi.testclient import TestClient
from app.db.models import User

def test_ledger_route(client: TestClient, test_buyer: User):
    # test_buyer has role=buyer, so they shouldn't access ledger
    from app.core.security import create_access_token
    token = create_access_token(test_buyer.id, "buyer")
    response = client.get("/api/v1/payments/ledger/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_balance_route(client: TestClient, test_buyer: User):
    from app.core.security import create_access_token
    token = create_access_token(test_buyer.id, "seller") # Mock seller token
    response = client.get("/api/v1/payments/balance/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "balance" in response.json()
