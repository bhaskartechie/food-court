"""
API v1 router — aggregates all endpoint sub-routers.

Each sub-router declares its own prefix and tags so this file stays clean.
Adding a new feature area requires only a single import + include_router() call.
"""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    buyers,
    delivery,
    menus,
    orders,
    payments,
    payouts,
    ratings,
    sellers,
    suggestions,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(sellers.router)
router.include_router(buyers.router)
router.include_router(menus.router)
router.include_router(orders.router)
router.include_router(ratings.router)
router.include_router(admin.router)
router.include_router(payments.router)
router.include_router(payouts.router)
router.include_router(delivery.router)
router.include_router(suggestions.router)

