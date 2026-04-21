from fastapi import APIRouter, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect
from typing import Optional, List
from pydantic import BaseModel
from config.database import get_database
from middleware.auth import get_current_active_user
from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid
import asyncio

router = APIRouter(prefix="/api/seat-bookings", tags=["Seat Bookings"])

RESERVATION_TIMEOUT_MINUTES = 5

class SeatStatus(str, Enum):
    RESERVED = "reserved"
    BOOKED = "booked"

class SeatSyncRequest(BaseModel):
    route_id: str
    travel_date: str
    desired_seats: List[str]  # The FULL list of seats the user wants

# WebSocket connections registry
_ws_connections: dict = {}

async def _notify_seat_change(route_id: str, travel_date: str):
    key = f"{route_id}:{travel_date}"
    for ws in list(_ws_connections.get(key, [])):
        try:
            await ws.send_json({"type": "seat_update", "route_id": route_id, "travel_date": travel_date})
        except Exception:
            _ws_connections.get(key, set()).discard(ws)

# =========== GET seat map ===========
@router.get("/")
async def get_seat_map(
    route_id: str = Query(...),
    travel_date: str = Query(...)
):
    """Get the live seat map for a route on a date."""
    db = get_database()

    route = await db.travel_routes.find_one({"$or": [{"_id": route_id}, {"id": route_id}]})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    total_seats = route.get("total_seats", 45)

    # Clean expired reservations
    await db.seat_bookings.delete_many({
        "route_id": route_id,
        "travel_date": travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.now(timezone.utc)}
    })

    # Fetch all active seat bookings
    bookings = await db.seat_bookings.find(
        {"route_id": route_id, "travel_date": travel_date, "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}},
        {"_id": 0, "seat_number": 1, "status": 1, "user_id": 1, "reservation_id": 1}
    ).to_list(200)

    booked_map = {}
    for b in bookings:
        booked_map[b["seat_number"]] = {"status": b["status"], "user_id": b.get("user_id"), "reservation_id": b.get("reservation_id")}

    seat_map = []
    for i in range(1, total_seats + 1):
        sn = str(i)
        info = booked_map.get(sn)
        seat_map.append({
            "seat_number": i,
            "row": chr(65 + (i - 1) // 4),
            "position": ((i - 1) % 4) + 1,
            "status": info["status"] if info else "available",
            "user_id": info.get("user_id") if info else None,
            "reservation_id": info.get("reservation_id") if info else None,
        })

    booked_count = sum(1 for s in seat_map if s["status"] == "booked")
    reserved_count = sum(1 for s in seat_map if s["status"] == "reserved")

    return {
        "seat_map": seat_map,
        "statistics": {
            "total": total_seats,
            "available": total_seats - booked_count - reserved_count,
            "booked": booked_count,
            "reserved": reserved_count,
        },
        "layout": {"columns": 4, "rows": (total_seats + 3) // 4, "aisle_after": 2},
    }


# =========== SYNC seats (the single smart endpoint) ===========
@router.post("/sync")
async def sync_seats(
    req: SeatSyncRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Sync the user's seat selection. Accepts the FULL desired seat list.
    - Releases any seats the user held that are NOT in the new list.
    - Reserves any new seats that are in the list but not yet held.
    - Idempotent: calling with the same list twice is a no-op.
    """
    db = get_database()
    user_id = current_user["_id"]

    route = await db.travel_routes.find_one({"$or": [{"_id": req.route_id}, {"id": req.route_id}]})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    total_seats = route.get("total_seats", 45)

    # Validate seat numbers
    for sn in req.desired_seats:
        n = int(sn) if sn.isdigit() else 0
        if n < 1 or n > total_seats:
            raise HTTPException(status_code=400, detail=f"Seat {sn} out of range (1-{total_seats})")

    # Clean expired reservations for ALL users
    await db.seat_bookings.delete_many({
        "route_id": req.route_id,
        "travel_date": req.travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.now(timezone.utc)}
    })

    # Get this user's current reservations
    user_current = await db.seat_bookings.find(
        {"route_id": req.route_id, "travel_date": req.travel_date, "user_id": user_id, "status": SeatStatus.RESERVED}
    ).to_list(100)
    user_current_seats = {b["seat_number"] for b in user_current}

    desired_set = set(req.desired_seats)
    to_release = user_current_seats - desired_set
    to_reserve = desired_set - user_current_seats

    # Check if new seats are available (not held by others)
    if to_reserve:
        conflicts = await db.seat_bookings.find(
            {
                "route_id": req.route_id,
                "travel_date": req.travel_date,
                "seat_number": {"$in": list(to_reserve)},
                "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]},
                "user_id": {"$ne": user_id},
            }
        ).to_list(100)
        if conflicts:
            taken = [c["seat_number"] for c in conflicts]
            raise HTTPException(status_code=409, detail=f"Seats already taken: {', '.join(taken)}")

    # Release old seats
    if to_release:
        await db.seat_bookings.delete_many({
            "route_id": req.route_id,
            "travel_date": req.travel_date,
            "seat_number": {"$in": list(to_release)},
            "user_id": user_id,
            "status": SeatStatus.RESERVED,
        })

    # Reserve new seats
    expiry = datetime.now(timezone.utc) + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)
    # Reuse existing reservation_id if user already has one, else create new
    existing_res_id = user_current[0]["reservation_id"] if user_current else str(uuid.uuid4())

    if to_reserve:
        price_per_seat = route.get("price", route.get("base_price", 0))
        new_docs = []
        for sn in to_reserve:
            new_docs.append({
                "_id": str(uuid.uuid4()),
                "reservation_id": existing_res_id,
                "route_id": req.route_id,
                "vehicle_id": route.get("vehicle_id"),
                "travel_date": req.travel_date,
                "seat_number": sn,
                "status": SeatStatus.RESERVED,
                "payment_status": "pending",
                "user_id": user_id,
                "reserved_at": datetime.now(timezone.utc),
                "reservation_expires": expiry,
                "price": price_per_seat,
                "created_at": datetime.now(timezone.utc),
            })
        await db.seat_bookings.insert_many(new_docs)

    # Extend expiry on kept seats
    kept = desired_set & user_current_seats
    if kept:
        await db.seat_bookings.update_many(
            {"route_id": req.route_id, "travel_date": req.travel_date, "seat_number": {"$in": list(kept)}, "user_id": user_id, "status": SeatStatus.RESERVED},
            {"$set": {"reservation_expires": expiry}}
        )

    await _notify_seat_change(req.route_id, req.travel_date)

    return {
        "message": "Seats synced",
        "reservation_id": existing_res_id,
        "seats": list(desired_set),
        "released": list(to_release),
        "newly_reserved": list(to_reserve),
        "expires_at": expiry.isoformat(),
        "timeout_minutes": RESERVATION_TIMEOUT_MINUTES,
    }


# =========== Legacy release endpoint (for page unload) ===========
@router.post("/release")
async def release_seats(
    route_id: str = Query(...),
    travel_date: str = Query(...),
    seat_numbers: List[str] = Query(default=[]),
    current_user: dict = Depends(get_current_active_user)
):
    """Release reserved seats."""
    db = get_database()
    query = {"route_id": route_id, "travel_date": travel_date, "user_id": current_user["_id"], "status": SeatStatus.RESERVED}
    if seat_numbers:
        query["seat_number"] = {"$in": seat_numbers}
    result = await db.seat_bookings.delete_many(query)
    await _notify_seat_change(route_id, travel_date)
    return {"message": f"Released {result.deleted_count} seats"}


# =========== Legacy reserve endpoint (for backward compat) ===========
class SeatReservationRequest(BaseModel):
    route_id: str
    travel_date: str
    seat_numbers: List[str]

@router.post("/reserve")
async def reserve_seats(
    reservation: SeatReservationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Reserve seats — redirects to sync internally."""
    req = SeatSyncRequest(route_id=reservation.route_id, travel_date=reservation.travel_date, desired_seats=reservation.seat_numbers)
    return await sync_seats(req, current_user)


# =========== Confirm (lock seats permanently after payment) ===========
class SeatConfirmRequest(BaseModel):
    route_id: str
    travel_date: str
    seat_numbers: List[str]
    order_id: Optional[str] = None
    passengers: Optional[List[dict]] = None  # accepted and stored if provided

@router.post("/confirm")
async def confirm_seats(
    payload: SeatConfirmRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark the given reserved seats as BOOKED (owned by this user) after successful payment.
    Idempotent: already-booked seats owned by the same user are returned as confirmed.
    """
    db = get_database()
    user_id = current_user["_id"]

    # Only operate on seats the user has actually reserved (or already booked) for this route+date
    query = {
        "route_id": payload.route_id,
        "travel_date": payload.travel_date,
        "user_id": user_id,
        "seat_number": {"$in": payload.seat_numbers},
    }
    update = {
        "$set": {
            "status": SeatStatus.BOOKED,
            "payment_status": "paid",
            "confirmed_at": datetime.now(timezone.utc),
        }
    }
    if payload.order_id:
        update["$set"]["order_id"] = payload.order_id
    # Remove TTL field so booked seats never expire
    update["$unset"] = {"reservation_expires": ""}

    result = await db.seat_bookings.update_many(query, update)
    await _notify_seat_change(payload.route_id, payload.travel_date)
    return {
        "message": f"Confirmed {result.modified_count} seats",
        "confirmed": payload.seat_numbers,
    }


# =========== Counts for search results ===========
@router.get("/available-counts")
async def get_available_seat_counts(
    route_ids: str = Query(...),
    travel_date: str = Query(...)
):
    """Get available seat counts for multiple routes."""
    db = get_database()
    ids = [rid.strip() for rid in route_ids.split(",") if rid.strip()]

    await db.seat_bookings.delete_many({
        "travel_date": travel_date, "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.now(timezone.utc)}
    })

    pipeline = [
        {"$match": {"route_id": {"$in": ids}, "travel_date": travel_date, "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}}},
        {"$group": {"_id": "$route_id", "booked": {"$sum": 1}}}
    ]
    counts = {}
    async for doc in db.seat_bookings.aggregate(pipeline):
        counts[doc["_id"]] = doc["booked"]

    result = {}
    for rid in ids:
        route = await db.travel_routes.find_one({"$or": [{"_id": rid}, {"id": rid}]}, {"total_seats": 1})
        total = route.get("total_seats", 45) if route else 45
        booked = counts.get(rid, 0)
        result[rid] = {"total": total, "booked": booked, "available": total - booked}

    return {"counts": result}


# =========== User bookings ===========
@router.get("/my-bookings")
async def get_my_bookings(
    booking_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    db = get_database()
    query = {"user_id": current_user["_id"]}
    if booking_status:
        query["status"] = booking_status
    bookings = await db.seat_bookings.find(query, {"_id": 0}).sort("travel_date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.seat_bookings.count_documents(query)
    return {"bookings": bookings, "total": total}


@router.post("/release-beacon")
async def release_seats_beacon(
    route_id: str = Query(...),
    travel_date: str = Query(...),
    user_id: str = Query(...)
):
    """Release reserved seats via beacon (page unload)."""
    db = get_database()
    result = await db.seat_bookings.delete_many({
        "route_id": route_id, "travel_date": travel_date,
        "user_id": user_id, "status": SeatStatus.RESERVED
    })
    await _notify_seat_change(route_id, travel_date)
    return {"message": f"Released {result.deleted_count} seats"}


# =========== WebSocket for live updates ===========
seat_ws_router = APIRouter()

@seat_ws_router.websocket("/ws/seats/{route_id}/{travel_date}")
async def seat_websocket(websocket: WebSocket, route_id: str, travel_date: str):
    await websocket.accept()
    key = f"{route_id}:{travel_date}"
    if key not in _ws_connections:
        _ws_connections[key] = set()
    _ws_connections[key].add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _ws_connections.get(key, set()).discard(websocket)
    except Exception:
        _ws_connections.get(key, set()).discard(websocket)
