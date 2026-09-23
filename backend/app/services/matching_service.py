"""
Culinary Matching Engine — Society Food Platform.

Matches resident buyers' cravings with home chefs based on:
1. Category compatibility (Veg, Non-Veg, Snacks, Desserts, Beverages)
2. Dish name & culinary keyword overlap (Bio, Active menus, Culinary knowledge base)
3. Existing menu item overlaps (dishes the chef already cooks)
4. Kitchen readiness (is_open status & chef ratings)
5. Demand urgency (community upvote momentum)
"""

import re
import logging
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.db.models import DishSuggestion, Menu, SellerProfile, User
from app.db.models.enums import MenuCategory, SuggestionStatus
from app.services.ai_service import CULINARY_KNOWLEDGE_BASE

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "at",
    "by", "from", "is", "it", "my", "our", "this", "that", "want", "craving",
    "please", "make", "need", "like", "home", "style", "homemade"
}


def _tokenize(text: str | None) -> set[str]:
    """Tokenize and filter stop words from text."""
    if not text:
        return set()
    words = re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())
    return {w for w in words if len(w) > 2 and w not in STOP_WORDS}


def calculate_craving_seller_match(
    craving: DishSuggestion,
    seller_profile: SellerProfile,
    seller_menus: list[Menu],
) -> dict[str, Any]:
    """
    Computes a 0-100% compatibility score between a resident's craving and a home chef's kitchen.
    """
    reasons: list[str] = []
    matching_menu_items: list[dict[str, Any]] = []

    craving_tokens = _tokenize(f"{craving.title} {craving.description or ''}")
    craving_cat = craving.category.value if hasattr(craving.category, "value") else str(craving.category)

    # Collect chef's culinary profile tokens and category footprint
    chef_bio = seller_profile.bio or ""
    bio_tokens = _tokenize(chef_bio)

    chef_categories = {
        m.category.value if hasattr(m.category, "value") else str(m.category)
        for m in seller_menus
    }

    # 1. Pure-Veg vs Non-Veg Strict Compatibility Guard
    is_non_veg_craving = craving_cat in ["non-veg", "non_veg"] or any(
        w in craving_tokens for w in ["chicken", "mutton", "egg", "fish", "prawn", "meat", "nonveg", "non-veg"]
    )
    chef_has_non_veg = (
        any(cat in ["non-veg", "non_veg"] for cat in chef_categories)
        or any(w in bio_tokens for w in ["chicken", "mutton", "egg", "fish", "prawn", "meat", "nonveg", "non-veg"])
    )

    if is_non_veg_craving and not chef_has_non_veg:
        return {
            "suggestion_id": craving.id,
            "seller_id": seller_profile.id,
            "match_score": 0,
            "match_level": "INCOMPATIBLE",
            "match_reasons": ["Chef operates a pure-vegetarian kitchen"],
            "matching_menu_items": [],
        }

    score = 0.0

    # 2. Category Match (up to 30 pts)
    if craving_cat in chef_categories:
        score += 30.0
        reasons.append(f"Category Match: Active {craving_cat.upper()} specialist")
    elif craving_cat in chef_bio.lower():
        score += 20.0
        reasons.append(f"Bio Specialty Match: Prepares {craving_cat}")
    else:
        score += 10.0

    # 3. Dish Name & Culinary Keyword Overlap (up to 45 pts)
    keyword_points = 0.0
    direct_dish_match_found = False

    for menu in seller_menus:
        menu_tokens = _tokenize(f"{menu.name} {menu.description or ''}")
        overlap = craving_tokens.intersection(menu_tokens)

        # Check for direct title similarity
        title_lower = craving.title.lower()
        menu_name_lower = menu.name.lower()
        if any(token in menu_name_lower for token in craving_tokens):
            direct_dish_match_found = True
            matching_menu_items.append({
                "id": menu.id,
                "name": menu.name,
                "price": float(menu.price),
                "category": menu.category.value if hasattr(menu.category, "value") else str(menu.category),
                "is_available": menu.is_available,
            })

        if overlap:
            keyword_points = max(keyword_points, min(35.0, len(overlap) * 15.0))

    if direct_dish_match_found:
        keyword_points = max(keyword_points, 40.0)
        reasons.append(f"Existing Menu Match: You already cook '{matching_menu_items[0]['name']}'")
    elif keyword_points > 0:
        reasons.append(f"Culinary Flavor Match: Menu keywords align with {craving.title}")

    # Check bio keywords
    bio_overlap = craving_tokens.intersection(bio_tokens)
    if bio_overlap:
        keyword_points = min(45.0, keyword_points + len(bio_overlap) * 10.0)
        reasons.append(f"Specialty Highlight: Bio mentions {', '.join(list(bio_overlap)[:2])}")

    # Check knowledge base tags
    for key, data in CULINARY_KNOWLEDGE_BASE.items():
        if key in craving.title.lower() or key in (craving.description or "").lower():
            for tag in data.get("tags", []):
                tag_tokens = _tokenize(tag)
                if tag_tokens.intersection(bio_tokens) or any(tag_tokens.intersection(_tokenize(m.name)) for m in seller_menus):
                    keyword_points = min(45.0, keyword_points + 10.0)
                    reasons.append(f"Cuisine Tag: {tag}")
                    break
            break

    score += min(45.0, keyword_points)

    # 4. Kitchen Activity & Chef Reputation (up to 15 pts)
    if seller_profile.is_open:
        score += 10.0
        reasons.append("Kitchen Ready: Accepting orders right now")
    if seller_profile.rating >= 4.0:
        score += 5.0
        reasons.append(f"Top Rated Chef: {seller_profile.rating:.1f}★ rating")

    # 5. Community Demand Momentum (up to 10 pts)
    upvote_points = min(10.0, float(craving.upvotes_count) * 2.0)
    score += upvote_points
    if craving.upvotes_count >= 3:
        reasons.append(f"High Demand: {craving.upvotes_count} neighbors craving this")

    final_score = min(100, max(0, int(round(score))))
    if final_score >= 75:
        match_level = "HIGH"
    elif final_score >= 45:
        match_level = "MEDIUM"
    else:
        match_level = "LOW"

    return {
        "suggestion_id": craving.id,
        "seller_id": seller_profile.id,
        "match_score": final_score,
        "match_level": match_level,
        "match_reasons": reasons[:3],  # Top 3 concise reasons
        "matching_menu_items": matching_menu_items,
    }


def get_matched_cravings_for_seller(
    db: Session,
    seller_id: int,
    min_score: int = 35,
    limit: int = 30,
) -> list[dict[str, Any]]:
    """
    Returns open community cravings matching the specified seller's kitchen,
    sorted by match_score desc and upvotes_count desc.
    """
    seller_profile = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller_profile:
        return []

    seller_user = db.query(User).filter(User.id == seller_id).first()
    seller_menus = db.query(Menu).filter(Menu.seller_id == seller_id).all()

    open_cravings = (
        db.query(DishSuggestion)
        .filter(DishSuggestion.status == SuggestionStatus.open)
        .order_by(DishSuggestion.upvotes_count.desc(), DishSuggestion.created_at.desc())
        .limit(100)
        .all()
    )

    matched_results = []
    for craving in open_cravings:
        # Don't match seller to their own suggestions
        if craving.user_id == seller_id:
            continue

        match_data = calculate_craving_seller_match(craving, seller_profile, seller_menus)
        if match_data["match_score"] >= min_score:
            craving_user = db.query(User).filter(User.id == craving.user_id).first()
            matched_results.append({
                "id": craving.id,
                "user_id": craving.user_id,
                "user_name": craving_user.name if craving_user else "Resident",
                "user_flat": craving_user.flat_number if craving_user else None,
                "title": craving.title,
                "description": craving.description,
                "category": craving.category.value if hasattr(craving.category, "value") else str(craving.category),
                "target_date": craving.target_date.isoformat() if craving.target_date else None,
                "upvotes_count": craving.upvotes_count,
                "status": craving.status.value if hasattr(craving.status, "value") else str(craving.status),
                "match_score": match_data["match_score"],
                "match_level": match_data["match_level"],
                "match_reasons": match_data["match_reasons"],
                "matching_menu_items": match_data["matching_menu_items"],
                "created_at": craving.created_at.isoformat(),
            })

    # Sort primarily by match score desc, secondarily by upvotes desc
    matched_results.sort(key=lambda x: (x["match_score"], x["upvotes_count"]), reverse=True)
    return matched_results[:limit]

