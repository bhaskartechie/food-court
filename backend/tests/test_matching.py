"""Tests for Culinary Matching Engine & Seller Acceptance Flow."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.models import DishSuggestion, Menu, SellerProfile, User
from app.db.models.enums import ApprovalStatus, MenuCategory, SuggestionStatus, UserRole
from app.services.matching_service import (
    calculate_craving_seller_match,
    get_matched_cravings_for_seller,
)


def test_matching_pure_veg_incompatibility(db: Session):
    # Setup pure-veg chef
    chef = User(name="Pure Veg Chef", email="vegchef@test.com", role=UserRole.seller)
    db.add(chef)
    db.commit()
    profile = SellerProfile(id=chef.id, bio="100% Pure Jain & Satvik Food", is_open=True, rating=4.8)
    menu_dal = Menu(seller_id=chef.id, name="Dal Tadka", category=MenuCategory.veg, price=120)
    db.add_all([profile, menu_dal])
    db.commit()

    # Craving: Non-veg Biryani
    craving = DishSuggestion(
        user_id=1,
        title="Spicy Chicken Dum Biryani",
        category=MenuCategory.non_veg,
        upvotes_count=5,
        status=SuggestionStatus.open,
    )

    result = calculate_craving_seller_match(craving, profile, [menu_dal])
    assert result["match_score"] == 0
    assert result["match_level"] == "INCOMPATIBLE"
    assert "pure-vegetarian" in result["match_reasons"][0].lower()


def test_matching_high_compatibility(db: Session):
    # Setup Biryani & Mughlai chef
    chef = User(name="Chef Meera", email="meerachef@test.com", role=UserRole.seller)
    db.add(chef)
    db.commit()
    profile = SellerProfile(id=chef.id, bio="Specialist in Hyderabadi Biryani & curries", is_open=True, rating=4.9)
    menu_biryani = Menu(seller_id=chef.id, name="Hyderabadi Chicken Biryani", category=MenuCategory.non_veg, price=240)
    db.add_all([profile, menu_biryani])
    db.commit()

    # Craving: Biryani
    craving = DishSuggestion(
        user_id=1,
        title="Authentic Hyderabadi Dum Biryani",
        description="Craving flavorful home-cooked spicy biryani",
        category=MenuCategory.non_veg,
        upvotes_count=8,
        status=SuggestionStatus.open,
    )

    result = calculate_craving_seller_match(craving, profile, [menu_biryani])
    assert result["match_score"] >= 80
    assert result["match_level"] == "HIGH"
    assert len(result["matching_menu_items"]) > 0
    assert result["matching_menu_items"][0]["name"] == "Hyderabadi Chicken Biryani"


def test_get_matched_cravings_endpoint(client: TestClient, db: Session):
    # 1. Setup chef
    chef = User(name="Snack Chef", email="snackchef@test.com", role=UserRole.seller, is_active=True)
    db.add(chef)
    db.commit()
    profile = SellerProfile(id=chef.id, bio="Authentic Mumbai Vada Pav and Gujarati snacks", is_open=True)
    menu_snack = Menu(seller_id=chef.id, name="Mumbai Vada Pav", category=MenuCategory.snacks, price=40)
    db.add_all([profile, menu_snack])
    db.commit()

    token = create_access_token(chef.id, "seller")
    chef_headers = {"Authorization": f"Bearer {token}"}

    # 2. Buyer creates snack craving
    buyer = User(name="Craving Resident", email="buyer_snack@test.com", role=UserRole.buyer, is_active=True)
    db.add(buyer)
    db.commit()
    buyer_token = create_access_token(buyer.id, "buyer")
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    client.post(
        "/api/v1/suggestions/",
        headers=buyer_headers,
        json={"title": "Crispy Vada Pav with Lasun Chutney", "category": "snacks"},
    )

    # 3. Chef calls /matched endpoint
    matched_res = client.get("/api/v1/suggestions/matched", headers=chef_headers)
    assert matched_res.status_code == 200
    data = matched_res.json()
    assert len(data["suggestions"]) >= 1
    top_match = data["suggestions"][0]
    assert "Vada Pav" in top_match["title"]
    assert top_match["match_score"] >= 50


def test_claim_suggestion_with_existing_menu_item(client: TestClient, db: Session):
    # Setup chef with dish
    chef = User(name="Dosa Chef", email="dosachef@test.com", role=UserRole.seller, is_active=True)
    db.add(chef)
    db.commit()
    profile = SellerProfile(id=chef.id, bio="South Indian Tiffin", is_open=True)
    menu_dosa = Menu(seller_id=chef.id, name="Ghee Roast Masala Dosa", category=MenuCategory.veg, price=110)
    db.add_all([profile, menu_dosa])
    db.commit()

    chef_token = create_access_token(chef.id, "seller")
    chef_headers = {"Authorization": f"Bearer {chef_token}"}

    # Setup suggestion
    buyer = User(name="Dosa Lover", email="dosalover@test.com", role=UserRole.buyer, is_active=True)
    db.add(buyer)
    db.commit()
    buyer_token = create_access_token(buyer.id, "buyer")
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    res = client.post(
        "/api/v1/suggestions/",
        headers=buyer_headers,
        json={"title": "Hot Masala Dosa", "category": "veg"},
    )
    sug_id = res.json()["id"]

    # Claim using existing menu item
    claim_res = client.post(
        f"/api/v1/suggestions/{sug_id}/claim",
        headers=chef_headers,
        json={"existing_menu_id": menu_dosa.id},
    )
    assert claim_res.status_code == 200
    claim_data = claim_res.json()
    assert claim_data["menu_id"] == menu_dosa.id
    assert claim_data["price"] == 110.0
    assert claim_data["status"] == "claimed_by_chef"

    # Verify listing response is enriched with seller and menu details
    list_res = client.get("/api/v1/suggestions/")
    assert list_res.status_code == 200
    claimed_item = next(s for s in list_res.json()["suggestions"] if s["id"] == sug_id)
    assert claimed_item["seller_name"] == "Dosa Chef"
    assert claimed_item["menu_name"] == "Ghee Roast Masala Dosa"
    assert claimed_item["menu_price"] == 110.0

