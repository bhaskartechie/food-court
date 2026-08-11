"""Admin management routes"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/sellers/pending")
async def get_pending_sellers(skip: int = 0, limit: int = 20):
    """Get pending seller approvals (admin only)"""
    # TODO: Implement get pending sellers
    return {"sellers": [], "total": 0}


@router.post("/sellers/{seller_id}/approve")
async def approve_seller(seller_id: int):
    """Approve pending seller (admin only)"""
    # TODO: Implement approve seller
    return {"message": "Seller approved"}


@router.post("/sellers/{seller_id}/reject")
async def reject_seller(seller_id: int, reason: str = None):
    """Reject pending seller (admin only)"""
    # TODO: Implement reject seller
    return {"message": "Seller rejected"}


@router.get("/analytics")
async def get_analytics():
    """Get platform analytics (admin only)"""
    # TODO: Implement get analytics
    return {
        "total_sellers": 0,
        "total_buyers": 0,
        "total_orders": 0,
        "daily_orders": [],
    }


@router.get("/residents")
async def get_residents(skip: int = 0, limit: int = 20):
    """Get all residents (admin only)"""
    # TODO: Implement get residents
    return {"residents": [], "total": 0}
