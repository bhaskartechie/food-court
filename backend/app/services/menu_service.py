"""Menu service — CRUD for a seller's menu items."""

import logging
import os
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import Menu, SellerProfile
from app.schemas.menu import MenuCreateRequest, MenuUpdateRequest

logger = logging.getLogger(__name__)

# ── Image Upload Config ───────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads/menus")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_MB = 5


def get_seller_menus(
    db: Session,
    seller_id: int,
    available_only: bool = True,
    category: str | None = None,
    search: str | None = None,
) -> dict:
    """
    Return menu items for a seller.

    Supports filtering by:
      - available_only: only items with is_available=True (default)
      - category:       filter by MenuCategory value (e.g. 'veg', 'non-veg')
      - search:         case-insensitive substring match on item name
    """
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller {seller_id} not found.",
        )

    query = db.query(Menu).filter(Menu.seller_id == seller_id)

    if available_only:
        query = query.filter(Menu.is_available == True)

    if category:
        query = query.filter(Menu.category == category)

    if search:
        query = query.filter(Menu.name.ilike(f"%{search}%"))

    items = query.all()
    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category,
                "price": float(item.price),
                "is_available": item.is_available,
                "quantity": item.quantity,
                "image_url": item.image_url,
                "is_preorder_only": item.is_preorder_only,
                "preorder_cutoff_time": item.preorder_cutoff_time,
                "available_slots": item.available_slots or [],
                "max_batch_quantity": item.max_batch_quantity,
                "min_lead_time_hours": item.min_lead_time_hours,
                "spice_level": item.spice_level or "medium",
            }
            for item in items
        ],
        "total": len(items),
    }


def create_menu_item(
    db: Session,
    seller_id: int,
    request: MenuCreateRequest,
) -> Menu:
    """Create a new menu item for the given seller."""
    seller = db.query(SellerProfile).filter(SellerProfile.id == seller_id).first()
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seller {seller_id} not found.",
        )

    item = Menu(
        seller_id=seller_id,
        name=request.name,
        description=request.description,
        category=request.category,
        price=request.price,
        is_available=request.is_available,
        quantity=request.quantity if request.quantity is not None else 0,
        is_preorder_only=request.is_preorder_only,
        preorder_cutoff_time=request.preorder_cutoff_time,
        available_slots=request.available_slots,
        max_batch_quantity=request.max_batch_quantity,
        min_lead_time_hours=request.min_lead_time_hours,
        image_url=request.image_url,
        spice_level=request.spice_level or "medium",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_menu_item(
    db: Session,
    menu_id: int,
    request: MenuUpdateRequest,
    owner_id: int | None = None,
) -> Menu:
    """
    Update a menu item's fields.
    If owner_id is provided, ensures the item belongs to that seller.
    """
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.seller_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    if request.name is not None:
        item.name = request.name
    if request.description is not None:
        item.description = request.description
    if request.price is not None:
        item.price = request.price
    if request.category is not None:
        item.category = request.category
    if request.is_available is not None:
        item.is_available = request.is_available
    if request.quantity is not None:
        item.quantity = max(0, request.quantity)
        if request.quantity == 0 and request.is_available is None:
            item.is_available = False
        elif request.quantity > 0 and request.is_available is None and not item.is_available:
            item.is_available = True
    if request.is_preorder_only is not None:
        item.is_preorder_only = request.is_preorder_only
    if request.preorder_cutoff_time is not None:
        item.preorder_cutoff_time = request.preorder_cutoff_time
    if request.available_slots is not None:
        item.available_slots = request.available_slots
    if request.max_batch_quantity is not None:
        item.max_batch_quantity = request.max_batch_quantity
    if request.min_lead_time_hours is not None:
        item.min_lead_time_hours = request.min_lead_time_hours
    if request.image_url is not None:
        item.image_url = request.image_url
    if request.spice_level is not None:
        item.spice_level = request.spice_level

    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item



def delete_menu_item(db: Session, menu_id: int, owner_id: int | None = None) -> None:
    """Delete a menu item. Optionally validates ownership."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.seller_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    db.delete(item)
    db.commit()


def toggle_availability(
    db: Session,
    menu_id: int,
    is_available: bool,
    quantity: int | None = None,
    owner_id: int | None = None,
) -> Menu:
    """Toggle the is_available flag and portions on a menu item."""
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.seller_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    if quantity is not None:
        item.quantity = max(0, quantity)
        item.is_available = is_available if (quantity > 0 or is_available) else False
    else:
        item.is_available = is_available
        if is_available and item.quantity == 0:
            item.quantity = 10  # replenish default stock if toggled on with 0 portions

    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item



async def upload_menu_image(
    db: Session,
    menu_id: int,
    file: UploadFile,
    owner_id: int | None = None,
) -> Menu:
    """
    Upload an image for a menu item and store it on the local filesystem.

    Saves to: uploads/menus/{menu_id}.{ext}
    Updates: Menu.image_url with the relative path (served as static file)
    """
    item = db.query(Menu).filter(Menu.id == menu_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found."
        )

    if owner_id and item.seller_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your menu item."
        )

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {file.content_type}. "
                   f"Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Read and validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too large ({size_mb:.1f} MB). Maximum allowed: {MAX_IMAGE_SIZE_MB} MB.",
        )

    # Determine extension from content type
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ext = ext_map.get(file.content_type, "jpg")

    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Remove old image if it exists
    if item.image_url:
        old_path = Path(item.image_url.lstrip("/"))
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    # Save new image
    filename = f"{menu_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    # Update DB record — store as URL-friendly path
    item.image_url = f"/uploads/menus/{filename}"
    item.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)

    logger.info("Menu image uploaded: menu_id=%s path=%s size=%.1fKB",
                menu_id, file_path, len(content) / 1024)
    return item
