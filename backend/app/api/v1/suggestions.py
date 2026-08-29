"""
Suggestions routes — Community Cravings & Demand Marketplace.

Public / Authenticated:
  GET  /api/v1/suggestions/                 → list trending dish suggestions
  POST /api/v1/suggestions/                 → propose a new dish craving (auth)
  POST /api/v1/suggestions/{id}/upvote      → toggle upvote on a craving (auth)
  POST /api/v1/suggestions/{id}/claim       → chef accepts dish & launches pre-order (seller)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, require_role
from app.core.security import decode_token
from app.db.models import User
from app.schemas.suggestion import (
    SuggestionClaimRequest,
    SuggestionCreateRequest,
    SuggestionResponse,
    UpvoteResponse,
)
from app.services import suggestion_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/suggestions", tags=["suggestions"])

DB_DEPENDENCY = Depends(get_db)
GET_USER_DEPENDENCY = Depends(get_current_user)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("seller", "admin"))


@router.get("/")
async def list_suggestions(
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=100),
    authorization: str | None = Header(default=None),
    db: Session = DB_DEPENDENCY,
):
    """
    List community cravings & dish suggestions.
    Optionally pass Bearer token in header to populate `has_upvoted` flag.
    """
    current_user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = decode_token(token)
            current_user_id = int(payload.get("sub", 0))
        except Exception:
            pass

    return suggestion_service.list_suggestions(
        db,
        current_user_id=current_user_id,
        status_filter=status_filter,
        category=category,
        skip=skip,
        limit=limit,
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_suggestion(
    request: SuggestionCreateRequest,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Propose a new dish suggestion to the society community (authenticated)."""
    suggestion = suggestion_service.create_suggestion(
        db, user_id=current_user.id, request=request
    )
    return {
        "id": suggestion.id,
        "title": suggestion.title,
        "category": suggestion.category,
        "upvotes_count": suggestion.upvotes_count,
        "status": suggestion.status,
        "message": "Dish suggestion published to the community!",
    }


@router.post("/{suggestion_id}/upvote", response_model=UpvoteResponse)
async def toggle_upvote(
    suggestion_id: int,
    current_user: User = GET_USER_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Toggle upvote on a community dish suggestion."""
    return suggestion_service.toggle_upvote(
        db, user_id=current_user.id, suggestion_id=suggestion_id
    )


@router.post("/{suggestion_id}/claim")
async def claim_suggestion(
    suggestion_id: int,
    request: SuggestionClaimRequest,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Home chef accepts a community craving and launches a pre-order batch menu item.
    """
    return suggestion_service.claim_suggestion(
        db,
        seller_id=current_user.id,
        suggestion_id=suggestion_id,
        request=request,
    )
