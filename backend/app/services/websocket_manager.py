"""
WebSocket connection manager — manages real-time order status push connections.

Single-server, in-memory manager. Each order can have multiple listeners
(buyer and seller can both watch the same order simultaneously).

Usage in routes:
    manager = get_manager()
    await manager.connect(order_id, websocket)
    await manager.broadcast_order_update(order_id, {"status": "accepted"})
    manager.disconnect(order_id, websocket)

Note: This in-memory approach works for a single server (MVP).
For multi-server deployments (Phase 2), replace with Redis pub/sub.
"""

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections grouped by order_id.

    Multiple clients can subscribe to the same order_id (e.g., buyer and seller
    both tracking the same order). All are notified on any status change.
    """

    def __init__(self) -> None:
        # { order_id: [WebSocket, ...] }
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, order_id: int, websocket: WebSocket) -> None:
        """Accept and register a WebSocket connection for the given order."""
        await websocket.accept()
        if order_id not in self._connections:
            self._connections[order_id] = []
        self._connections[order_id].append(websocket)
        logger.info("WS connect: order_id=%s total_listeners=%d",
                    order_id, len(self._connections[order_id]))

    def disconnect(self, order_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket connection from the pool."""
        if order_id in self._connections:
            try:
                self._connections[order_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[order_id]:
                del self._connections[order_id]
        logger.info("WS disconnect: order_id=%s", order_id)

    async def broadcast_order_update(self, order_id: int, data: dict[str, Any]) -> None:
        """
        Push a JSON payload to all WebSocket clients subscribed to the given order.

        Silently drops stale connections (already disconnected clients).
        """
        listeners = self._connections.get(order_id, [])
        if not listeners:
            return

        dead: list[WebSocket] = []
        for ws in listeners:
            try:
                await ws.send_json(data)
            except Exception as exc:
                logger.debug("WS send failed for order %s: %s — marking dead", order_id, exc)
                dead.append(ws)

        # Cleanup dead connections
        for ws in dead:
            self.disconnect(order_id, ws)

    def active_count(self, order_id: int) -> int:
        """Return number of active listeners for an order (useful for health checks)."""
        return len(self._connections.get(order_id, []))


# ── Singleton ─────────────────────────────────────────────────────────────────
# One manager instance shared across the application lifetime.
_manager: ConnectionManager | None = None


def get_manager() -> ConnectionManager:
    """Return the application-wide WebSocket connection manager."""
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
