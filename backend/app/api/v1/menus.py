"""
Menu routes — menu item management for sellers.

Public:
  GET  /api/v1/menus/sellers/{seller_id}     → list a seller's menu items
                                                 ?available_only, ?category, ?search

Authenticated (seller):
  POST /api/v1/menus/                        → create a menu item
  PUT  /api/v1/menus/{menu_id}               → update a menu item
  DELETE /api/v1/menus/{menu_id}             → delete a menu item
  PATCH /api/v1/menus/{menu_id}/availability → toggle availability
  POST  /api/v1/menus/{menu_id}/image        → upload menu item image
"""

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_role
from app.db.models import User
from app.schemas.menu import AvailabilityRequest, MenuCreateRequest, MenuUpdateRequest
from app.services import menu_service

router = APIRouter(prefix="/api/v1/menus", tags=["menus"])

DB_DEPENDENCY = Depends(get_db)
SELLER_OR_ADMIN_DEPENDENCY = Depends(require_role("seller", "admin"))


@router.get("/sellers/{seller_id}")
async def get_seller_menus(
    seller_id: int,
    available_only: bool = Query(default=True, description="Only return available items"),
    category: str | None = Query(
        default=None,
        description="Filter by category: veg, non_veg, snacks, desserts, beverages"
    ),
    search: str | None = Query(
        default=None,
        description="Case-insensitive search on item name"
    ),
    db: Session = DB_DEPENDENCY,
):
    """Get menu items for a given seller (public). Supports category and name filters."""
    return menu_service.get_seller_menus(
        db,
        seller_id=seller_id,
        available_only=available_only,
        category=category,
        search=search,
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_menu_item(
    request: MenuCreateRequest,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Create a new menu item. The seller_id is taken from the authenticated user."""
    item = menu_service.create_menu_item(db, seller_id=current_user.id, request=request)
    return {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "price": item.price,
        "is_available": item.is_available,
    }


@router.put("/{menu_id}")
async def update_menu_item(
    menu_id: int,
    request: MenuUpdateRequest,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Update a menu item. Sellers can only update their own items."""
    owner_id = current_user.id if current_user.role == "seller" else None
    menu_service.update_menu_item(
        db, menu_id=menu_id, request=request, owner_id=owner_id
    )
    return {"message": "Menu item updated.", "id": menu_id}


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    menu_id: int,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Delete a menu item."""
    owner_id = current_user.id if current_user.role == "seller" else None
    menu_service.delete_menu_item(db, menu_id=menu_id, owner_id=owner_id)


@router.patch("/{menu_id}/availability")
async def toggle_availability(
    menu_id: int,
    request: AvailabilityRequest,
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """Toggle the availability of a menu item."""
    owner_id = current_user.id if current_user.role == "seller" else None
    item = menu_service.toggle_availability(
        db, menu_id=menu_id, is_available=request.is_available, owner_id=owner_id
    )
    return {"id": item.id, "is_available": item.is_available}


@router.post("/{menu_id}/image")
async def upload_image(
    menu_id: int,
    file: UploadFile = File(..., description="Image file (JPEG, PNG, WebP, GIF — max 5 MB)"),
    current_user: User = SELLER_OR_ADMIN_DEPENDENCY,
    db: Session = DB_DEPENDENCY,
):
    """
    Upload an image for a menu item.

    Saves the image to the local filesystem under uploads/menus/.
    Returns the updated menu item with the new image_url.
    """
    owner_id = current_user.id if current_user.role == "seller" else None
    item = await menu_service.upload_menu_image(
        db, menu_id=menu_id, file=file, owner_id=owner_id
    )
    return {
        "id": item.id,
        "name": item.name,
        "image_url": item.image_url,
        "message": "Image uploaded successfully.",
    }
