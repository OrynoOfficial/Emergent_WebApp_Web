"""
Manual / Walk-in Bookings

Allows operators to record on-site / cash bookings side-by-side with online ones.
All bookings are stored in the unified `orders` collection with `channel="on_site"`
and `is_manual=True` so existing booking flows, receipts, and analytics treat them
as first-class citizens.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

from config.database import get_database
from middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/operator/manual-bookings", tags=["Manual Bookings"])


SERVICE_COLLECTION_MAP = {
    "travel": "travel_routes",
    "hotel": "hotels",
    "car_rental": "car_rentals",
    "restaurant": "restaurants",
    "event": "events",
    "package": "packages",
    "cinema": "cinemas",
    "laundry": "pressings",
    "banquet": "banquets",
}

SERVICE_PREFIX_MAP = {
    "hotel": "HTL", "travel": "TRV", "car_rental": "CAR", "restaurant": "RST",
    "event": "EVT", "package": "PKG", "cinema": "CIN", "laundry": "LND", "banquet": "BQT",
}

ALLOWED_PAYMENT_METHODS = {
    "cash", "pos", "bank_transfer", "mtn_momo", "orange_money", "other"
}


class GuestCustomer(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class ManualBookingCreate(BaseModel):
    service_type: str = Field(..., description="hotel|travel|car_rental|restaurant|event|package|cinema|laundry|banquet")
    service_id: str
    service_name: Optional[str] = None
    total_amount: float
    currency: str = "XAF"
    payment_method: str = Field(..., description="cash|pos|bank_transfer|mtn_momo|orange_money|other")
    customer: GuestCustomer
    booking_details: Dict[str, Any] = {}
    notes: Optional[str] = None
    service_date: Optional[str] = None


async def _find_linked_customer(db, phone: Optional[str], email: Optional[str]) -> Optional[dict]:
    """Find an existing platform user by phone/email (case-insensitive) to link the booking."""
    import re
    query_terms = []
    if email:
        # Escape user input to prevent regex metacharacter exploitation
        safe_email = re.escape(email.strip())
        query_terms.append({"email": {"$regex": f"^{safe_email}$", "$options": "i"}})
    if phone:
        cleaned = phone.strip().replace(" ", "")
        query_terms.append({"phone": cleaned})
        query_terms.append({"phone_number": cleaned})
    if not query_terms:
        return None
    user = await db.users.find_one({"$or": query_terms}, {"_id": 1, "email": 1, "phone": 1, "full_name": 1})
    return user


async def _lock_travel_seats(db, service_id: str, travel_date: str, seats: List[str],
                             reservation_id: str, operator_user_id: str, price_per_seat: float,
                             linked_user_id: Optional[str]):
    """Atomically book the selected seats for a travel route. Raises 409 on conflict."""
    if not seats or not travel_date:
        return

    # Expire stale reservations first
    await db.seat_bookings.delete_many({
        "route_id": service_id,
        "travel_date": travel_date,
        "status": "reserved",
        "reservation_expires": {"$lt": datetime.now(timezone.utc)},
    })

    # Check conflicts
    conflicts = await db.seat_bookings.find({
        "route_id": service_id,
        "travel_date": travel_date,
        "seat_number": {"$in": list(map(str, seats))},
        "status": {"$in": ["reserved", "booked"]},
    }).to_list(100)
    if conflicts:
        taken = [c["seat_number"] for c in conflicts]
        raise HTTPException(status_code=409, detail=f"Seats already taken: {', '.join(taken)}")

    docs = []
    now = datetime.now(timezone.utc)
    for s in seats:
        docs.append({
            "_id": str(uuid.uuid4()),
            "reservation_id": reservation_id,
            "route_id": service_id,
            "travel_date": travel_date,
            "seat_number": str(s),
            "status": "booked",
            "payment_status": "paid",
            "user_id": linked_user_id,  # May be None for guest walk-ins
            "channel": "on_site",
            "is_manual": True,
            "created_by_operator_user_id": operator_user_id,
            "reserved_at": now,
            "price": price_per_seat,
            "created_at": now,
        })
    if docs:
        await db.seat_bookings.insert_many(docs)


@router.post("/")
async def create_manual_booking(
    data: ManualBookingCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Operator records a walk-in / cash booking for any service they manage."""
    db = get_database()

    # Authorization: only operator staff or admins
    role = current_user.get("role", "")
    operator_id = current_user.get("operator_id")
    if role not in ("operator", "admin", "super_admin") and not operator_id:
        raise HTTPException(status_code=403, detail="Operator access required")

    if data.service_type not in SERVICE_COLLECTION_MAP:
        raise HTTPException(status_code=400, detail=f"Unsupported service_type: {data.service_type}")
    if data.payment_method not in ALLOWED_PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail=f"Unsupported payment_method: {data.payment_method}")
    if data.total_amount < 0:
        raise HTTPException(status_code=400, detail="total_amount must be non-negative")

    # Load service and verify operator scope
    col_name = SERVICE_COLLECTION_MAP[data.service_type]
    svc = await db[col_name].find_one({"$or": [{"_id": data.service_id}, {"id": data.service_id}]})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    svc_operator_id = svc.get("operator_id")
    if role not in ("admin", "super_admin"):
        if not operator_id or svc_operator_id != operator_id:
            raise HTTPException(status_code=403, detail="You cannot record bookings for services outside your operator")

    # Find a linked customer, if any
    linked = await _find_linked_customer(db, data.customer.phone, data.customer.email)
    linked_user_id = linked.get("_id") if linked else None

    # Build order
    now = datetime.now(timezone.utc)
    prefix = SERVICE_PREFIX_MAP.get(data.service_type, "ORD")
    order_id = str(uuid.uuid4())
    order_number = f"{prefix}-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    operator_user_id = current_user.get("_id") or current_user.get("id")

    service_name = data.service_name or svc.get("name") or svc.get("service_name") or svc.get("vehicle_name") or "Service"

    # Travel-specific seat locking
    if data.service_type == "travel":
        seats = data.booking_details.get("seat_numbers") or data.booking_details.get("seats") or []
        if not isinstance(seats, list):
            seats = [s.strip() for s in str(seats).split(",") if s.strip()]
        travel_date = data.service_date or data.booking_details.get("travel_date")
        if not travel_date:
            raise HTTPException(status_code=400, detail="travel_date is required for travel bookings")
        if not seats:
            raise HTTPException(status_code=400, detail="At least one seat must be selected")

        price_per_seat = data.total_amount / max(len(seats), 1)
        await _lock_travel_seats(
            db,
            service_id=data.service_id,
            travel_date=travel_date,
            seats=seats,
            reservation_id=order_id,
            operator_user_id=operator_user_id,
            price_per_seat=price_per_seat,
            linked_user_id=linked_user_id,
        )
        # Enrich booking_details with canonical vehicle info for the ticket
        vehicle_id = svc.get("vehicle_id")
        vehicle = None
        if vehicle_id:
            vehicle = await db.vehicles.find_one(
                {"$or": [{"_id": vehicle_id}, {"id": vehicle_id}]},
                {"_id": 0, "plate_number": 1, "vehicle_name": 1, "model": 1, "manufacturer": 1, "images": 1, "vehicle_type": 1},
            )
        data.booking_details = {
            **data.booking_details,
            "seat_numbers": list(map(str, seats)),
            "travel_date": travel_date,
            "from_city": svc.get("from_city"),
            "to_city": svc.get("to_city"),
            "departure_time": svc.get("departure_time"),
            "vehicle_info": vehicle or {},
        }

    order = {
        "_id": order_id,
        "order_number": order_number,
        "user_id": linked_user_id,  # May be None for guest walk-ins
        "user_email": (linked or {}).get("email") or data.customer.email or "",
        "service_type": data.service_type,
        "service_category": data.service_type,
        "service_id": data.service_id,
        "service_name": service_name,
        "operator_id": svc_operator_id,
        "operator_name": svc.get("operator_name", ""),
        "subtotal": data.total_amount,
        "tax": 0,
        "discount": 0,
        "total_amount": data.total_amount,
        "final_amount": data.total_amount,
        "currency": data.currency,
        "status": "confirmed",
        "payment_status": "paid",
        "payment_method": data.payment_method,
        "paid_at": now,
        "booking_details": data.booking_details,
        # Walk-in / manual booking markers
        "channel": "on_site",
        "is_manual": True,
        "created_by_operator_user_id": operator_user_id,
        "guest_customer": data.customer.dict(),
        "customer_linked": bool(linked_user_id),
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db.orders.insert_one(order)

    # Best-effort in-app notification to the linked customer
    if linked_user_id:
        try:
            await db.notifications.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": linked_user_id,
                "title": "Booking recorded at counter",
                "message": f"A {data.service_type} booking ({order_number}) was recorded at the operator counter.",
                "type": "booking",
                "notification_type": "booking",
                "source": "manual_booking",
                "dedupe_key": f"order:{order_id}:created",
                "action_url": "/orders",
                "data": {"order_id": order_id, "order_number": order_number},
                "is_read": False,
                "created_at": now,
            })
        except Exception:
            pass

    return {
        "success": True,
        "message": "Walk-in booking recorded",
        "order_id": order_id,
        "order_number": order_number,
        "customer_linked": bool(linked_user_id),
        "linked_user": {
            "id": linked.get("_id"),
            "full_name": linked.get("full_name"),
            "email": linked.get("email"),
        } if linked else None,
    }


@router.get("/")
async def list_operator_bookings(
    service_type: Optional[str] = Query(None),
    channel: str = Query("all", description="all|online|on_site"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """List bookings for the operator, optionally filtered by channel/service_type."""
    db = get_database()
    role = current_user.get("role", "")
    operator_id = current_user.get("operator_id")

    query: Dict[str, Any] = {}
    if role not in ("admin", "super_admin"):
        if not operator_id:
            raise HTTPException(status_code=403, detail="Operator access required")
        query["operator_id"] = operator_id

    if service_type:
        query["service_type"] = service_type

    if channel == "online":
        query["$or"] = [{"channel": {"$exists": False}}, {"channel": "online"}]
    elif channel == "on_site":
        query["channel"] = "on_site"

    if date_from or date_to:
        date_query: Dict[str, Any] = {}
        try:
            if date_from:
                date_query["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_query["$lte"] = datetime.fromisoformat(date_to)
            if date_query:
                query["created_at"] = date_query
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format (use ISO 8601)")

    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    for it in items:
        for f in ("created_at", "updated_at", "paid_at"):
            if it.get(f) and hasattr(it[f], "isoformat"):
                it[f] = it[f].isoformat()

    total = await db.orders.count_documents(query)
    on_site_count = await db.orders.count_documents({**query, "channel": "on_site"})
    return {
        "bookings": items,
        "total": total,
        "on_site_count": on_site_count,
        "online_count": total - on_site_count,
    }


@router.get("/lookup-customer")
async def lookup_customer(
    phone: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Lookup an existing platform customer by phone or email for pre-filling a walk-in form."""
    role = current_user.get("role", "")
    if role not in ("operator", "admin", "super_admin") and not current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Operator access required")
    db = get_database()
    if not phone and not email:
        return {"found": False}
    linked = await _find_linked_customer(db, phone, email)
    if not linked:
        return {"found": False}
    return {
        "found": True,
        "customer": {
            "id": linked.get("_id"),
            "full_name": linked.get("full_name"),
            "email": linked.get("email"),
            "phone": linked.get("phone"),
        },
    }
