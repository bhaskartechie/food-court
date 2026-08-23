"""Tests for auth endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models import User

def test_register_user(client: TestClient, db: Session):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "New User",
            "email": "newuser@test.com",
            "password": "strongpassword123",
            "role": "buyer",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@test.com"

def test_login_user(client: TestClient, db: Session, test_buyer: User):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "buyer@test.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

def test_change_password(client: TestClient, buyer_headers: dict):
    response = client.patch(
        "/api/v1/auth/me/password",
        json={
            "current_password": "password123",
            "new_password": "newpassword123",
        },
        headers=buyer_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully."
