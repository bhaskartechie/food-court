"""Menu management routes — with real database queries."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.models import Menu, SellerProfile

router = APIRouter(prefix="/api/v1/menus", tags=["menus"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class MenuCreateRequest(BaseModel):
    seller_id: int
    name: str
    description: str = ""
    category: str  # veg | non-veg | snacks | desserts
    price: float
    is_available: bool = True


class MenuUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    category: str | None = None


class AvailabilityRequest(BaseModel):
    is_available: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/sellers/{seller_id}")
async def get_seller_menus(
    seller_id: int,
    available_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    """Get all menu items for a seller."""
    # Verify seller exists
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller with id {seller_id} not found.",
        )

    query = db.query(Menu).filter(Menu.seller_id == seller_id)
    if available_only:
        query = query.filter(Menu.is_available == True)  # noqa: E712

    items = query.all()
    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category,
                "price": item.price,
                "is_available": item.is_available,
            }
            for item in items
        ],
        "total": len(items),
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_menu_item(request: MenuCreateRequest, db: Session = Depends(get_db)):
    """Create a new menu item for a seller."""
    # Validate category
    valid_categories = {"veg", "non-veg", "snacks", "desserts"}
    if request.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}",
        )

    # Verify seller exists
    seller = db.query(SellerProfile).filter(SellerProfile.id == request.seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller with id {request.seller_id} not found.",
        )

    menu_item = Menu(
        seller_id=request.seller_id,
        name=request.name,
        description=request.description,
        category=request.category,
        price=request.price,
        is_available=request.is_available,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(menu_item)
    db.commit()
    db.refresh(menu_item)

    return {
        "id": menu_item.id,
        "name": menu_item.name,
        "category": menu_item.category,
        "price": menu_item.price,
        "is_available": menu_item.is_available,
    }


@router.put("/{menu_id}")
async def update_menu_item(
    menu_id: int,
    request: MenuUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update a menu item."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    if request.name is not None:
        item.name = request.name
    if request.description is not None:
        item.description = request.description
    if request.price is not None:
        item.price = request.price
    if request.category is not None:
        item.category = request.category

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    return {"message": "Menu item updated", "id": menu_id}


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(menu_id: int, db: Session = Depends(get_db)):
    """Delete a menu item."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    db.delete(item)
    db.commit()
    return None


@router.patch("/{menu_id}/availability")
async def toggle_availability(
    menu_id: int,
    request: AvailabilityRequest,
    db: Session = Depends(get_db),
):
    """Toggle menu item availability."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    item.is_available = request.is_available
    item.updated_at = datetime.utcnow()
    db.commit()

    return {"id": menu_id, "is_available": item.is_available}
