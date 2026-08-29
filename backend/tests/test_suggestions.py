"""Tests for community dish suggestions and upvotes."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import SellerProfile, User
from app.db.models.enums import ApprovalStatus, UserRole


def test_create_and_list_suggestions(client: TestClient, buyer_headers: dict):
    # 1. Create a dish craving
    res = client.post(
        "/api/v1/suggestions/",
        headers=buyer_headers,
        json={
            "title": "Hyderabadi Dum Biryani",
            "description": "Authentic spicy dum biryani for Sunday lunch",
            "category": "non-veg",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Hyderabadi Dum Biryani"
    assert data["upvotes_count"] == 1
    suggestion_id = data["id"]

    # 2. List suggestions
    list_res = client.get("/api/v1/suggestions/", headers=buyer_headers)
    assert list_res.status_code == 200
    suggestions = list_res.json()["suggestions"]
    assert any(s["id"] == suggestion_id for s in suggestions)


def test_toggle_upvote(client: TestClient, db: Session, test_buyer: User, buyer_headers: dict):
    # Create suggestion
    res = client.post(
        "/api/v1/suggestions/",
        headers=buyer_headers,
        json={"title": "Ragi Dosa with Chutney", "category": "veg"},
    )
    sug_id = res.json()["id"]

    # Another user upvotes it
    other_user = User(
        name="Neighbor 2",
        email="neighbor2@test.com",
        role=UserRole.buyer,
        is_active=True,
    )
    db.add(other_user)
    db.commit()
    token = create_access_token(other_user.id, "buyer")
    headers = {"Authorization": f"Bearer {token}"}

    # Upvote
    upvote_res = client.post(f"/api/v1/suggestions/{sug_id}/upvote", headers=headers)
    assert upvote_res.status_code == 200
    assert upvote_res.json()["upvotes_count"] == 2
    assert upvote_res.json()["has_upvoted"] is True

    # Remove upvote
    downvote_res = client.post(f"/api/v1/suggestions/{sug_id}/upvote", headers=headers)
    assert downvote_res.status_code == 200
    assert downvote_res.json()["upvotes_count"] == 1
    assert downvote_res.json()["has_upvoted"] is False


def test_chef_claim_suggestion(client: TestClient, db: Session, test_buyer: User, buyer_headers: dict):
    # 1. Buyer creates suggestion
    res = client.post(
        "/api/v1/suggestions/",
        headers=buyer_headers,
        json={"title": "Gujarati Khandvi", "category": "snacks"},
    )
    sug_id = res.json()["id"]

    # 2. Setup a chef
    chef_user = User(
        name="Chef Patel",
        email="chefpatel@test.com",
        role=UserRole.seller,
        is_active=True,
    )
    db.add(chef_user)
    db.commit()
    chef_profile = SellerProfile(
        id=chef_user.id,
        bio="Authentic Gujarati snacks",
        approval_status=ApprovalStatus.approved,
    )
    db.add(chef_profile)
    db.commit()

    chef_token = create_access_token(chef_user.id, "seller")
    chef_headers = {"Authorization": f"Bearer {chef_token}"}

    # 3. Chef claims suggestion
    claim_res = client.post(
        f"/api/v1/suggestions/{sug_id}/claim",
        headers=chef_headers,
        json={
            "price": 90.0,
            "max_batch_quantity": 20,
            "preorder_cutoff_time": "11:30",
            "available_slots": ["lunch_today", "dinner_today"],
        },
    )
    assert claim_res.status_code == 200
    data = claim_res.json()
    assert data["status"] == "claimed_by_chef"
    assert data["menu_id"] is not None
