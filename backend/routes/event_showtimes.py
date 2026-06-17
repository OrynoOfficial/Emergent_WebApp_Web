"""
Event Showtimes API — scheduled instances at an EventLocation. Each Showtime
carries its own `classes[]` (VIP / Standard / ...). Booking decrements
`available_units` on the targeted class atomically.

Permissions mirror `event_locations`.
"""
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from config.database import get_database
from middleware.auth import get_current_active_user, get_current_user_optional
from models.event_showtime import (
    EventShowtimeCreate,
    EventShowtimeUpdate,
    ShowtimeStatus,
    TicketClassInput,
)
from utils.permissions import require_any_permission

router = APIRouter(prefix="/api/event-showtimes", tags=["Event Showtimes"])

_VIEW_PERMS = ["events.view", "operator.services.view", "services.view"]
_CREATE_PERMS = ["events.create", "operator.services.create", "services.manage"]
_EDIT_PERMS = ["events.edit", "operator.services.edit", "services.manage"]
_DELETE_PERMS = ["events.delete", "operator.services.delete", "services.manage"]


def _hydrate_classes(class_inputs: List[TicketClassInput]) -> list[dict]:
    """Coerce class payload into the persisted shape — assign IDs, mirror
    `total_units` onto `available_units` for fresh classes."""
    out = []
    for c in class_inputs:
        body = c.dict() if hasattr(c, "dict") else dict(c)
        body["id"] = body.get("id") or str(uuid.uuid4())
        body["available_units"] = body.get("total_units", 0)
        out.append(body)
    return out


@router.post("/")
async def create_showtime(
    payload: EventShowtimeCreate,
    current_user: dict = Depends(require_any_permission(_CREATE_PERMS)),
):
    db = get_database()
    location = await db.event_locations.find_one({"_id": payload.location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    operator_id = payload.operator_id or location.get("operator_id")
    operator_name = payload.operator_name or location.get("operator_name", "")

    if not payload.classes:
        raise HTTPException(status_code=400, detail="At least one ticket class is required")

    doc = {
        "_id": str(uuid.uuid4()),
        "location_id": payload.location_id,
        "location_name": location.get("name", ""),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "title": payload.title,
        "description": payload.description,
        "event_type": payload.event_type,
        "poster_url": payload.poster_url,
        "images": payload.images or [],
        "start_datetime": payload.start_datetime,
        "end_datetime": payload.end_datetime,
        "doors_open_at": payload.doors_open_at,
        "classes": _hydrate_classes(payload.classes),
        "status": payload.status.value if isinstance(payload.status, ShowtimeStatus) else payload.status,
        "featured": payload.featured,
        "tags": payload.tags or [],
        "age_restriction": payload.age_restriction,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.event_showtimes.insert_one(doc)
    return {"id": doc["_id"], "message": "Showtime created"}


@router.get("/")
async def list_showtimes(
    operator_id: Optional[str] = None,
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    upcoming_only: bool = False,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Listing is OPEN — anonymous customers see all `active` showtimes.
    Operator/staff see their own (any status). Admin/super_admin see everything."""
    db = get_database()
    q = {}
    role = (current_user or {}).get("role")
    is_anonymous = current_user is None
    is_customer = role == "customer"
    is_operator_scope = role in ("operator", "staff")

    if operator_id:
        q["operator_id"] = operator_id
    elif is_operator_scope:
        q["operator_id"] = current_user.get("operator_id") or current_user.get("_id")
    if location_id:
        q["location_id"] = location_id

    if status:
        # Caller explicitly asked for a specific status — honour it, but force
        # `published` for anonymous/customer callers so drafts never leak.
        if (is_anonymous or is_customer) and status != ShowtimeStatus.PUBLISHED.value:
            q["status"] = ShowtimeStatus.PUBLISHED.value
        else:
            q["status"] = status
    elif is_anonymous or is_customer:
        # Default: hide drafts/cancelled/sold-out etc. from customer-facing views.
        q["status"] = ShowtimeStatus.PUBLISHED.value

    if upcoming_only:
        q["start_datetime"] = {"$gte": datetime.utcnow().isoformat()}

    showtimes = await db.event_showtimes.find(q).sort("start_datetime", 1).to_list(500)

    # Optional city filter: re-query the parent location collection once.
    if city and showtimes:
        loc_ids = list({s["location_id"] for s in showtimes})
        ok_ids = {
            l["_id"]
            async for l in db.event_locations.find(
                {"_id": {"$in": loc_ids}, "city": {"$regex": city, "$options": "i"}},
                {"_id": 1},
            )
        }
        showtimes = [s for s in showtimes if s["location_id"] in ok_ids]

    # Operator-logo enrichment (matches the platform-wide pattern).
    op_ids = list({s.get("operator_id") for s in showtimes if s.get("operator_id")})
    if op_ids:
        logo_map = {}
        async for op in db.operators.find({"_id": {"$in": op_ids}}, {"_id": 1, "logo_url": 1}):
            logo_map[op["_id"]] = op.get("logo_url")
        for s in showtimes:
            if s.get("operator_id") in logo_map:
                s["operator_logo_url"] = logo_map[s["operator_id"]]

    for s in showtimes:
        s["id"] = s.pop("_id", None)
    return {"showtimes": showtimes, "total": len(showtimes)}


@router.get("/{showtime_id}")
async def get_showtime(showtime_id: str):
    db = get_database()
    doc = await db.event_showtimes.find_one({"_id": showtime_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Showtime not found")
    doc["id"] = doc.pop("_id", None)
    if doc.get("operator_id"):
        op = await db.operators.find_one({"_id": doc["operator_id"]}, {"logo_url": 1})
        if op and op.get("logo_url"):
            doc["operator_logo_url"] = op["logo_url"]
    return doc


@router.put("/{showtime_id}")
async def update_showtime(
    showtime_id: str,
    payload: EventShowtimeUpdate,
    current_user: dict = Depends(require_any_permission(_EDIT_PERMS)),
):
    db = get_database()
    existing = await db.event_showtimes.find_one({"_id": showtime_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Showtime not found")
    if current_user.get("role") == "operator" and existing.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    # When classes are edited we re-hydrate them. For existing class IDs we
    # preserve `available_units` so already-sold tickets aren't double-counted;
    # new classes get available_units = total_units.
    if "classes" in update:
        existing_map = {c["id"]: c for c in existing.get("classes", [])}
        rebuilt = []
        for c in update["classes"]:
            body = c.dict() if hasattr(c, "dict") else dict(c)
            cid = body.get("id") or str(uuid.uuid4())
            body["id"] = cid
            if cid in existing_map:
                sold = existing_map[cid].get("total_units", 0) - existing_map[cid].get("available_units", 0)
                body["available_units"] = max(0, body["total_units"] - max(0, sold))
            else:
                body["available_units"] = body["total_units"]
            rebuilt.append(body)
        update["classes"] = rebuilt
    if "status" in update and hasattr(update["status"], "value"):
        update["status"] = update["status"].value
    update["updated_at"] = datetime.utcnow()
    await db.event_showtimes.update_one({"_id": showtime_id}, {"$set": update})
    return {"id": showtime_id, "message": "Showtime updated"}


@router.delete("/{showtime_id}")
async def delete_showtime(
    showtime_id: str,
    current_user: dict = Depends(require_any_permission(_DELETE_PERMS)),
):
    db = get_database()
    res = await db.event_showtimes.update_one(
        {"_id": showtime_id},
        {"$set": {"status": ShowtimeStatus.CANCELLED.value, "updated_at": datetime.utcnow()}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Showtime not found")
    return {"id": showtime_id, "message": "Showtime cancelled"}


# ── Booking ─────────────────────────────────────────────────────────────────
class BookTicketsPayload(BaseModel):
    showtime_id: str
    class_id: str
    quantity: int = 1
    seat_ids: Optional[List[str]] = None  # When the location is visual-grid /
                                          # zones, the customer can pick exact
                                          # seats. len(seat_ids) MUST equal qty.
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


@router.post("/book")
async def book_tickets(
    payload: BookTicketsPayload,
    current_user: dict = Depends(get_current_active_user),
):
    """Atomic class-targeted booking. Uses a positional $inc on the matching
    class element so two concurrent bookings can't both succeed once the last
    seat is gone. When seat_ids are sent, each seat is also reserved with
    `$addToSet` after confirming none of them are already booked."""
    db = get_database()
    if payload.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be ≥ 1")

    seat_ids = payload.seat_ids or []
    if seat_ids and len(seat_ids) != payload.quantity:
        raise HTTPException(status_code=400, detail="seat_ids count must equal quantity")
    if seat_ids and len(set(seat_ids)) != len(seat_ids):
        raise HTTPException(status_code=400, detail="Duplicate seat_ids in request")

    # Step 1: Atomic decrement. Includes a $nin guard on booked_seats so we
    # don't allow double-booking the same seat across two concurrent bookings.
    match = {
        "_id": payload.showtime_id,
        "classes": {
            "$elemMatch": {
                "id": payload.class_id,
                "available_units": {"$gte": payload.quantity},
            }
        },
    }
    if seat_ids:
        match["classes"]["$elemMatch"]["booked_seats"] = {"$nin": seat_ids}

    update = {"$inc": {"classes.$.available_units": -payload.quantity}}
    if seat_ids:
        update["$addToSet"] = {"classes.$.booked_seats": {"$each": seat_ids}}

    result = await db.event_showtimes.update_one(match, update)
    if not result.modified_count:
        # Diagnose the cause.
        showtime = await db.event_showtimes.find_one({"_id": payload.showtime_id})
        if not showtime:
            raise HTTPException(status_code=404, detail="Showtime not found")
        klass = next((c for c in showtime.get("classes", []) if c["id"] == payload.class_id), None)
        if not klass:
            raise HTTPException(status_code=404, detail="Class not found on this showtime")
        if seat_ids:
            already = set(klass.get("booked_seats") or []) & set(seat_ids)
            if already:
                raise HTTPException(status_code=409, detail=f"Seat(s) just taken: {', '.join(sorted(already))}")
        raise HTTPException(
            status_code=409,
            detail=f"Only {klass.get('available_units', 0)} '{klass['name']}' tickets left — requested {payload.quantity}.",
        )

    # Persist a booking doc on `orders` so it shows up in My Orders.
    showtime = await db.event_showtimes.find_one({"_id": payload.showtime_id})
    klass = next(c for c in showtime["classes"] if c["id"] == payload.class_id)
    # Service fee: 3% platform fee on the ticket subtotal.
    subtotal = float(klass["price"]) * payload.quantity
    service_fee = round(subtotal * 0.03, 2)
    total = round(subtotal + service_fee, 2)
    operator_logo_url = None
    if showtime.get("operator_id"):
        op = await db.operators.find_one({"_id": showtime["operator_id"]}, {"logo_url": 1})
        if op:
            operator_logo_url = op.get("logo_url")

    # Pull location info so the e-ticket can render venue policies / address
    # / map link without an extra round-trip on the customer side.
    location = await db.event_locations.find_one({"_id": showtime["location_id"]}) or {}

    order = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "service_type": "event",
        "service_id": payload.showtime_id,
        "service_name": showtime["title"],
        "operator_id": showtime.get("operator_id"),
        "operator_name": showtime.get("operator_name"),
        "operator_logo_url": operator_logo_url,
        "subtotal": subtotal,
        "service_fee": service_fee,
        "total_amount": total,
        "currency": klass.get("currency", "XAF"),
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "showtime_id": payload.showtime_id,
            "showtime_title": showtime["title"],
            "showtime_description": showtime.get("description"),
            "showtime_type": showtime.get("event_type"),
            "showtime_image": (showtime.get("images") or [None])[0],
            "location_id": showtime["location_id"],
            "location_name": showtime["location_name"],
            "location_address": location.get("address"),
            "location_city": location.get("city"),
            "location_latitude": location.get("latitude"),
            "location_longitude": location.get("longitude"),
            "location_policies": location.get("policies") or [],
            "start_datetime": showtime["start_datetime"],
            "end_datetime": showtime.get("end_datetime"),
            "doors_open_at": showtime.get("doors_open_at"),
            "class_id": payload.class_id,
            "class_name": klass["name"],
            "class_price": klass["price"],
            "class_color": klass.get("color"),
            "class_perks": klass.get("perks") or [],
            "quantity": payload.quantity,
            "seat_ids": seat_ids or [],
            "contact_name": payload.contact_name,
            "contact_phone": payload.contact_phone,
            "contact_email": payload.contact_email,
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.orders.insert_one(order)

    # Auto-flip status to sold_out when every class is empty.
    fresh = await db.event_showtimes.find_one({"_id": payload.showtime_id})
    if all((c.get("available_units") or 0) <= 0 for c in fresh.get("classes", [])):
        await db.event_showtimes.update_one(
            {"_id": payload.showtime_id},
            {"$set": {"status": ShowtimeStatus.SOLD_OUT.value, "updated_at": datetime.utcnow()}},
        )

    return {"success": True, "order_id": order["_id"], "total_amount": total}
