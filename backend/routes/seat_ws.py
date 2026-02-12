"""WebSocket manager for real-time seat selection."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from config.database import get_database
from models.seat_booking import SeatStatus
from typing import Dict, List, Set
from datetime import datetime, timedelta
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Seat WebSocket"])


class SeatConnectionManager:
    """Manages WebSocket connections grouped by route+date."""

    def __init__(self):
        # Key: "route_id:travel_date" → set of WebSocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}

    def _key(self, route_id: str, travel_date: str) -> str:
        return f"{route_id}:{travel_date}"

    async def connect(self, ws: WebSocket, route_id: str, travel_date: str):
        await ws.accept()
        key = self._key(route_id, travel_date)
        if key not in self.rooms:
            self.rooms[key] = set()
        self.rooms[key].add(ws)
        logger.info(f"WS connected: {key} (total: {len(self.rooms[key])})")

    def disconnect(self, ws: WebSocket, route_id: str, travel_date: str):
        key = self._key(route_id, travel_date)
        if key in self.rooms:
            self.rooms[key].discard(ws)
            if not self.rooms[key]:
                del self.rooms[key]
            logger.info(f"WS disconnected: {key}")

    async def broadcast(self, route_id: str, travel_date: str, message: dict):
        """Broadcast a message to all clients watching a route+date."""
        key = self._key(route_id, travel_date)
        if key not in self.rooms:
            return
        dead = []
        payload = json.dumps(message)
        for ws in self.rooms[key]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[key].discard(ws)


manager = SeatConnectionManager()


async def _get_seat_snapshot(route_id: str, travel_date: str) -> dict:
    """Build a full seat availability snapshot for a route+date."""
    db = get_database()

    route = await db.travel_routes.find_one(
        {"$or": [{"_id": route_id}, {"id": route_id}]}
    )
    total_seats = route.get("total_seats", 45) if route else 45
    seat_layout = route.get("seat_layout", {"rows": 5, "columns": 9}) if route else {"rows": 5, "columns": 9}

    # Clean expired reservations
    await db.seat_bookings.delete_many({
        "route_id": route_id,
        "travel_date": travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.utcnow()},
    })

    bookings = await db.seat_bookings.find(
        {
            "route_id": route_id,
            "travel_date": travel_date,
            "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]},
        },
        {"_id": 0, "seat_number": 1, "status": 1, "user_id": 1},
    ).to_list(500)

    booked_map = {}
    for b in bookings:
        booked_map[b["seat_number"]] = {
            "status": b["status"],
            "user_id": b.get("user_id"),
        }

    seat_map = []
    for i in range(1, total_seats + 1):
        sn = str(i)
        info = booked_map.get(sn)
        if info:
            seat_map.append({"seat_number": i, "status": info["status"], "user_id": info.get("user_id")})
        else:
            seat_map.append({"seat_number": i, "status": "available", "user_id": None})

    available_count = sum(1 for s in seat_map if s["status"] == "available")
    booked_count = sum(1 for s in seat_map if s["status"] == "booked")
    pending_count = sum(1 for s in seat_map if s["status"] == "reserved")

    return {
        "type": "seat_update",
        "seat_map": seat_map,
        "statistics": {
            "available": available_count,
            "booked": booked_count,
            "pending": pending_count,
            "total": total_seats,
        },
        "layout": seat_layout,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def broadcast_seat_change(route_id: str, travel_date: str):
    """Build a snapshot and broadcast to all connected clients."""
    snapshot = await _get_seat_snapshot(route_id, travel_date)
    await manager.broadcast(route_id, travel_date, snapshot)


@router.websocket("/api/ws/seats/{route_id}/{travel_date}")
async def seat_websocket(
    ws: WebSocket,
    route_id: str,
    travel_date: str,
):
    """
    WebSocket endpoint for real-time seat updates.

    On connect → sends full seat snapshot.
    Broadcasts whenever any client reserves/releases/books seats.
    Client can send JSON messages:
      {"action": "ping"}  → responds with pong
      {"action": "refresh"} → sends fresh snapshot to this client only
    """
    await manager.connect(ws, route_id, travel_date)

    # Send initial snapshot
    try:
        snapshot = await _get_seat_snapshot(route_id, travel_date)
        await ws.send_text(json.dumps(snapshot))
    except Exception as e:
        logger.error(f"Error sending initial snapshot: {e}")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
                action = msg.get("action")

                if action == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                elif action == "refresh":
                    snapshot = await _get_seat_snapshot(route_id, travel_date)
                    await ws.send_text(json.dumps(snapshot))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(ws, route_id, travel_date)
    except Exception:
        manager.disconnect(ws, route_id, travel_date)
