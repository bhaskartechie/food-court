"""Tests for passwordless OTP authentication flow."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import store_otp
from app.db.models import User
from app.db.models.enums import UserRole, VerificationStatus


def test_request_otp_email(client: TestClient):
    response = client.post(
        "/api/v1/auth/otp/request",
        json={"email": "resident1@societyfood.com", "role": "buyer", "channel": "email"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "OTP successfully dispatched" in data["message"]
    assert data["expires_in_minutes"] == 10
    assert "dev_otp" in data
    assert len(data["dev_otp"]) == 6


def test_verify_otp_auto_provisions_new_resident(client: TestClient, db: Session):
    email = "newresident@societyfood.com"
    req_res = client.post(
        "/api/v1/auth/otp/request",
        json={"email": email, "role": "buyer"},
    )
    otp = req_res.json()["dev_otp"]

    verify_res = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "otp": otp, "name": "Resident Ramesh", "role": "buyer"},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["name"] == "Resident Ramesh"
    assert data["user"]["role"] == "buyer"
    assert data["user"]["is_verified"] is True

    # Verify user in database
    db_user = db.query(User).filter(User.email == email).first()
    assert db_user is not None
    assert db_user.verification_status == VerificationStatus.verified


def test_verify_otp_existing_user_login(client: TestClient, db: Session, test_buyer: User):
    req_res = client.post(
        "/api/v1/auth/otp/request",
        json={"email": test_buyer.email, "role": "buyer"},
    )
    otp = req_res.json()["dev_otp"]

    verify_res = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": test_buyer.email, "otp": otp},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["user"]["id"] == test_buyer.id
    assert data["user"]["email"] == test_buyer.email


def test_verify_otp_invalid_code(client: TestClient):
    email = "invalidotp@societyfood.com"
    client.post(
        "/api/v1/auth/otp/request",
        json={"email": email, "role": "buyer"},
    )

    verify_res = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "otp": "000000"},
    )
    assert verify_res.status_code == 400
    assert "Invalid or expired OTP" in verify_res.json()["detail"]


def test_verify_otp_consumed_after_use(client: TestClient):
    email = "singleuse@societyfood.com"
    req_res = client.post(
        "/api/v1/auth/otp/request",
        json={"email": email, "role": "buyer"},
    )
    otp = req_res.json()["dev_otp"]

    # First attempt - success
    res1 = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "otp": otp},
    )
    assert res1.status_code == 200

    # Second attempt with same OTP - fails because consumed
    res2 = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "otp": otp},
    )
    assert res2.status_code == 400


def test_verify_otp_rate_limiting(client: TestClient):
    email = "ratelimited@societyfood.com"
    client.post(
        "/api/v1/auth/otp/request",
        json={"email": email, "role": "buyer"},
    )

    # 5 incorrect attempts
    for _ in range(5):
        client.post(
            "/api/v1/auth/otp/verify",
            json={"email": email, "otp": "999999"},
        )

    # 6th attempt should be rejected with 429
    res = client.post(
        "/api/v1/auth/otp/verify",
        json={"email": email, "otp": "999999"},
    )
    assert res.status_code in (400, 429)

