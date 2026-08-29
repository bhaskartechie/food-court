"""Suggestion service — Community dish requests, upvoting, and chef pre-order claim flow."""

import logging
from datetime import UTC, datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import DishSuggestion, DishUpvote, Menu, SellerProfile, User
from app.db.models.enums import MenuCategory, SuggestionStatus
from app.schemas.suggestion import SuggestionClaimRequest, SuggestionCreateRequest

logger = logging.getLogger(__name__)


def create_suggestion(
    db: Session, user_id: int, request: SuggestionCreateRequest
) -> DishSuggestion:
    """Create a new community dish request from a resident."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )

    suggestion = DishSuggestion(
        user_id=user_id,
        title=request.title,
        description=request.description,
        category=MenuCategory(request.category),
        target_date=request.target_date,
        upvotes_count=1,  # Author automatically upvotes their own suggestion
        status=SuggestionStatus.open,
    )
    db.add(suggestion)
    db.flush()

    # Record initial upvote by author
    upvote = DishUpvote(user_id=user_id, suggestion_id=suggestion.id)
    db.add(upvote)

    db.commit()
    db.refresh(suggestion)
    logger.info("New dish suggestion created: id=%s title='%s' by user_id=%s",
                suggestion.id, suggestion.title, user_id)
    return suggestion


def list_suggestions(
    db: Session,
    current_user_id: int | None = None,
    status_filter: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 30,
) -> dict:
    """List community dish suggestions, ordered by upvotes desc and recency."""
    query = db.query(DishSuggestion)

    if status_filter:
        try:
            query = query.filter(DishSuggestion.status == SuggestionStatus(status_filter))
        except ValueError:
            pass

    if category:
        try:
            query = query.filter(DishSuggestion.category == MenuCategory(category))
        except ValueError:
            pass

    total = query.count()
    suggestions = (
        query.order_by(DishSuggestion.upvotes_count.desc(), DishSuggestion.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Fetch set of suggestion IDs upvoted by current user
    user_upvoted_ids = set()
    if current_user_id:
        upvotes = (
            db.query(DishUpvote.suggestion_id)
            .filter(
                DishUpvote.user_id == current_user_id,
                DishUpvote.suggestion_id.in_([s.id for s in suggestions]),
            )
            .all()
        )
        user_upvoted_ids = {u[0] for u in upvotes}

    results = []
    for s in suggestions:
        user = db.query(User).filter(User.id == s.user_id).first()
        seller = (
            db.query(User).filter(User.id == s.accepted_by_seller_id).first()
            if s.accepted_by_seller_id
            else None
        )
        results.append({
            "id": s.id,
            "user_id": s.user_id,
            "user_name": user.name if user else "Resident",
            "user_flat": user.flat_number if user else None,
            "title": s.title,
            "description": s.description,
            "category": s.category,
            "target_date": s.target_date.isoformat() if s.target_date else None,
            "upvotes_count": s.upvotes_count,
            "status": s.status,
            "accepted_by_seller_id": s.accepted_by_seller_id,
            "seller_name": seller.name if seller else None,
            "created_menu_id": s.created_menu_id,
            "has_upvoted": s.id in user_upvoted_ids,
            "created_at": s.created_at.isoformat(),
        })

    return {"suggestions": results, "total": total}


def toggle_upvote(db: Session, user_id: int, suggestion_id: int) -> dict:
    """Toggle a resident's upvote on a community dish suggestion."""
    suggestion = db.query(DishSuggestion).filter(DishSuggestion.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dish suggestion not found."
        )

    existing = (
        db.query(DishUpvote)
        .filter(DishUpvote.user_id == user_id, DishUpvote.suggestion_id == suggestion_id)
        .first()
    )

    if existing:
        # Remove upvote
        db.delete(existing)
        suggestion.upvotes_count = max(0, suggestion.upvotes_count - 1)
        has_upvoted = False
        msg = "Upvote removed."
    else:
        # Add upvote
        new_upvote = DishUpvote(user_id=user_id, suggestion_id=suggestion_id)
        db.add(new_upvote)
        suggestion.upvotes_count += 1
        has_upvoted = True
        msg = "Upvote recorded!"

    db.commit()
    db.refresh(suggestion)
    return {
        "suggestion_id": suggestion.id,
        "upvotes_count": suggestion.upvotes_count,
        "has_upvoted": has_upvoted,
        "message": msg,
    }


def claim_suggestion(
    db: Session,
    seller_id: int,
    suggestion_id: int,
    request: SuggestionClaimRequest,
) -> dict:
    """
    Home chef accepts a community dish suggestion and launches a pre-order batch menu item.
    """
    seller_profile = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found."
        )

    suggestion = db.query(DishSuggestion).filter(DishSuggestion.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dish suggestion not found."
        )

    if suggestion.status != SuggestionStatus.open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot claim a suggestion in '{suggestion.status}' status.",
        )

    # 1. Automatically create a Pre-Order Menu Item for the chef
    menu_item = Menu(
        seller_id=seller_id,
        name=f"Special: {suggestion.title}",
        description=suggestion.description or f"Community requested dish by Flat {suggestion.user_id}",
        category=suggestion.category,
        price=request.price,
        is_available=True,
        is_preorder_only=True,
        preorder_cutoff_time=request.preorder_cutoff_time,
        available_slots=request.available_slots,
        max_batch_quantity=request.max_batch_quantity,
        min_lead_time_hours=request.min_lead_time_hours,
    )
    db.add(menu_item)
    db.flush()

    # 2. Update suggestion record
    suggestion.status = SuggestionStatus.claimed_by_chef
    suggestion.accepted_by_seller_id = seller_id
    suggestion.created_menu_id = menu_item.id

    db.commit()
    db.refresh(suggestion)
    db.refresh(menu_item)

    logger.info("Chef seller_id=%s claimed suggestion id=%s -> created menu_id=%s",
                seller_id, suggestion_id, menu_item.id)

    return {
        "message": f"Pre-order batch launched for '{suggestion.title}'!",
        "suggestion_id": suggestion.id,
        "menu_id": menu_item.id,
        "menu_name": menu_item.name,
        "price": float(menu_item.price),
        "status": suggestion.status,
    }
