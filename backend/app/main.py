"""
Society Food Platform — FastAPI application factory.

Entry points:
  Local dev:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  Docker:     entrypoint.sh runs the same command
  Docs:       http://localhost:8000/api/v1/docs
"""

import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import router as api_router
from app.core.config import settings
from app.services.websocket_manager import get_manager

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Society Food Platform API",
    description=(
        "Home food seller marketplace for residential societies.\n\n"
        "**Phase 1 MVP** — OTP auth, seller menus, order placement, ratings, "
        "real-time order tracking via WebSocket, and in-building delivery."
    ),
    version="1.1.0-alpha.1",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)


# ── Rate Limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ─────────────────────────────────────────────────────────────────
origins = (
    settings.CORS_ORIGINS.split(",")
    if isinstance(settings.CORS_ORIGINS, str)
    else settings.CORS_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router)

# ── Static Files (menu images) ────────────────────────────────────────────────
import os

os.makedirs("uploads/menus", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── WebSocket — Real-time Order Status ────────────────────────────────────────

@app.websocket("/ws/orders/{order_id}")
async def websocket_order_status(websocket: WebSocket, order_id: int):
    """
    WebSocket endpoint for real-time order status and delivery updates.

    Connect from the frontend:
      const ws = new WebSocket(`ws://localhost:8000/ws/orders/${orderId}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // data.event: 'order_status_changed' | 'delivery_status_changed'
        // data.status / data.delivery_status: new status value
      };

    Multiple clients can subscribe to the same order_id (buyer + seller).
    """
    manager = get_manager()
    await manager.connect(order_id, websocket)
    logger.info("WS client connected for order_id=%s", order_id)
    try:
        while True:
            # Keep the connection alive; accept pings from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(order_id, websocket)
        logger.info("WS client disconnected for order_id=%s", order_id)


# ── Core Endpoints ────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return RedirectResponse(url="/api/v1/docs")

@app.get("/", tags=["health"])
async def root():
    """Root endpoint — confirms the API is running."""
    return {
        "message": "Society Food Platform API",
        "version": "1.1.0-alpha.1",
        "environment": settings.ENVIRONMENT,
        "docs": "/api/v1/docs",
        "websocket": "ws://host/ws/orders/{order_id}",
    }


@app.get("/health", tags=["health"])
async def health():
    """Health check — used by Docker healthcheck and load balancers."""
    return {"status": "healthy", "service": "backend"}


# ── Global Exception Handler ─────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )


# ── Dev Runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
    )
