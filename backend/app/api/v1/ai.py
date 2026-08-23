"""
AI route — placeholder for post-MVP multimodal AI integration.

This module is intentionally NOT registered in app/api/v1/router.py for MVP.
To enable post-MVP: uncomment the import and include_router call in router.py.

Planned features (post-MVP):
  - POST /api/v1/ai/search   — multimodal food search (text + image)
  - GET  /api/v1/ai/stream   — Server-Sent Events streaming response
  - POST /api/v1/ai/suggest  — personalized meal suggestions based on order history
"""

# TODO (post-MVP): Implement AI integration
# from fastapi import APIRouter
# router = APIRouter(prefix="/api/v1/ai", tags=["ai"])
#
# @router.post("/search")
# async def multimodal_search(...):
#     ...
#
# @router.get("/stream")
# async def multimodal_stream(...):
#     ...
