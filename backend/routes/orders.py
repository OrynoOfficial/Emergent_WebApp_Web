from fastapi import APIRouter, HTTPException, status, Depends, Query, Header, Request
from pydantic import BaseModel
from models.order import Order, OrderCreate, OrderStatus, PaymentStatus
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from utils.rate_limit import limiter, user_or_ip_key, WRITE_ORDER_RATE
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import uuid

router = APIRouter(prefix="/api/orders", tags=["Orders"])


# How long an Idempotency-Key remains valid for replay protection. 24h is the
# Stripe-standard window — long enough to cover client retries, short enough
# that admins can re-use the same key after a day if they need to.
IDEMPOTENCY_TTL_HOURS = 24


async def _enrich_order_with_route(order: dict, db) -> dict:
    """Backfill missing route-derived fields on a travel order at read time.

    Older orders were persisted without ``booking_details.travel_date``,
    ``departure_city``/``destination_city`` or ``departure_time``, which caused
    the Order Details modal to show "N/A" or a blank "Service Info" row. This
    helper fetches the originating route (``service_id``) and fills any
    missing aliases so the ticket always matches what was booked.
    """
    if not isinstance(order, dict):
        return order
    if order.get("service_type") != "travel":
        return order

    bd = order.get("booking_details") or {}
    service_id = order.get("service_id")
    if not service_id:
        order["booking_details"] = bd
        return order

    # Only hit the DB if at least one field is actually missing
    needs_enrichment = any(bd.get(k) in (None, "") for k in (
        "travel_date", "departure_time", "arrival_time",
        "departure_city", "destination_city",
    ))
    if not needs_enrichment:
        order["booking_details"] = bd
        return order

    route = await db.travel_routes.find_one(
        {"$or": [{"_id": service_id}, {"id": service_id}]},
        {"_id": 0, "departure_time": 1, "arrival_time": 1,
         "from_city": 1, "to_city": 1, "operator_id": 1, "operator_name": 1,
         "date": 1},
    )
    if not route:
        order["booking_details"] = bd
        return order

    # Fill only the gaps — never overwrite an existing value
    if not bd.get("departure_time") and route.get("departure_time"):
        bd["departure_time"] = route["departure_time"]
    if not bd.get("arrival_time") and route.get("arrival_time"):
        bd["arrival_time"] = route["arrival_time"]
    if not bd.get("departure_city") and route.get("from_city"):
        bd["departure_city"] = route["from_city"]
    if not bd.get("destination_city") and route.get("to_city"):
        bd["destination_city"] = route["to_city"]
    if not bd.get("operator_name") and route.get("operator_name"):
        bd["operator_name"] = route["operator_name"]

    # Service Time aliases used by the Order Details modal
    svc_time = bd.get("service_time") or bd.get("travel_time") or bd.get("departure_time")
    if svc_time:
        bd.setdefault("service_time", svc_time)
        bd.setdefault("travel_time", svc_time)

    # Service Date alias: if travel_date missing but the route ships on a fixed date, use it
    if not bd.get("travel_date") and route.get("date"):
        bd["travel_date"] = route["date"]
    if bd.get("travel_date") and not bd.get("service_date"):
        bd["service_date"] = bd["travel_date"]

    order["booking_details"] = bd
    return order


@router.post("/", response_model=dict)
@limiter.limit(WRITE_ORDER_RATE, key_func=user_or_ip_key)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new order"""
    db = get_database()
    
    # Get service details
    service = await db.services.find_one({"_id": order_data.service_id})
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if not service["is_available"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service is not available"
        )
    
    # Calculate pricing
    subtotal = service["base_price"]
    tax = subtotal * 0.1  # 10% tax
    discount = 0.0
    
    # Apply promo code if provided
    if order_data.promo_code:
        promo = await db.promo_codes.find_one({"code": order_data.promo_code, "is_active": True})
        if promo:
            discount = subtotal * (promo["discount_percentage"] / 100)
    
    total_amount = subtotal + tax - discount
    
    # Generate order number
    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": current_user["_id"],
        "service_id": service["_id"],
        "service_name": service["name"],
        "service_category": service["category"],
        "subtotal": subtotal,
        "tax": tax,
        "discount": discount,
        "total_amount": total_amount,
        "currency": service["currency"],
        "payment_status": PaymentStatus.PENDING,
        "status": OrderStatus.PENDING,
        "order_details": order_data.order_details,
        "service_date": order_data.service_date,
        "customer_notes": order_data.customer_notes,
        "promo_code": order_data.promo_code,
        "promo_discount": discount,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    # Live rollup increment — fire-and-forget; rollup drift is recoverable.
    try:
        from utils.analytics_rollup import increment_rollup
        await increment_rollup(
            db,
            operator_id=order.get("operator_id"),
            service_category=service.get("category") if service else order.get("service_type"),
            status=order.get("status", "pending"),
            amount=order.get("total_amount", total_amount),
            created_at=order.get("created_at"),
        )
    except Exception as _exc:  # noqa: BLE001
        logging.getLogger(__name__).debug("rollup increment skipped: %s", _exc)

    return {
        "message": "Order created successfully",
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "total_amount": total_amount
    }


class DirectOrderCreate(BaseModel):
    """Model for creating an order directly without service lookup"""
    service_type: str
    service_id: str
    service_name: str
    total_amount: float
    currency: str = "XAF"
    status: str = "pending"
    payment_status: str = "pending"
    booking_details: dict = {}


@router.post("/create", response_model=dict)
@limiter.limit(WRITE_ORDER_RATE, key_func=user_or_ip_key)
async def create_direct_order(
    order_data: DirectOrderCreate,
    request: Request,
    current_user: dict = Depends(get_current_active_user),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    """
    Create an order directly without service lookup.
    For round trips, creates 2 separate tickets (orders) linked by trip_group_id, plus a single receipt.

    Idempotency:
        Clients SHOULD send an `Idempotency-Key` header (any UUID, max 128
        chars). The server stores the (user_id, key) pair after the first
        successful create — any later request with the same key returns the
        original response instead of inserting a duplicate order. This
        protects against slow-client retries on flaky networks.
    """
    db = get_database()

    user_id = current_user.get("_id") or current_user.get("id")

    # ── Idempotency replay protection ─────────────────────────────────────
    # If the caller sends an Idempotency-Key we've already processed for this
    # user within the TTL window, replay the original response verbatim.
    if idempotency_key:
        if len(idempotency_key) > 128:
            raise HTTPException(status_code=400, detail="Idempotency-Key must be ≤ 128 chars")
        existing = await db.idempotency_keys.find_one({
            "_id": f"{user_id}:{idempotency_key}",
        })
        if existing:
            return existing.get("response") or {"message": "Order already created (replay)"}
    
    service_prefix_map = {
        'hotel': 'HTL', 'travel': 'TRV', 'car_rental': 'CAR', 'restaurant': 'RST',
        'event': 'EVT', 'package': 'PKG', 'cinema': 'CIN', 'laundry': 'LND', 'banquet': 'BQT'
    }
    service_prefix = service_prefix_map.get(order_data.service_type, 'ORD')
    
    booking_details = order_data.booking_details or {}
    is_round_trip = booking_details.get("is_round_trip", False) and order_data.service_type == "travel"
    
    # Resolve operator_id from the service if not provided in the order
    operator_id = booking_details.get("operator_id") or None
    operator_name = booking_details.get("operator_name") or ""
    if not operator_id and order_data.service_id:
        svc_collection_map = {
            'travel': 'travel_routes', 'hotel': 'hotels', 'car_rental': 'car_rentals',
            'restaurant': 'restaurants', 'event': 'events', 'package': 'packages',
            'cinema': 'cinemas', 'laundry': 'pressings', 'banquet': 'banquets'
        }
        # Cinema is special: service_id is the showtime_id; we resolve the
        # operator through showtime -> cinema (drift-free against operator
        # reassignments because we always read the cinema row at write time).
        if order_data.service_type == "cinema":
            st = await db.showtimes.find_one(
                {"_id": order_data.service_id},
                {"cinema_id": 1}
            )
            cinema_id = st.get("cinema_id") if st else None
            if cinema_id:
                cin = await db.cinemas.find_one(
                    {"_id": cinema_id},
                    {"operator_id": 1, "operator_name": 1}
                )
                if cin:
                    operator_id = cin.get("operator_id")
                    operator_name = operator_name or cin.get("operator_name", "")
        else:
            col_name = svc_collection_map.get(order_data.service_type)
            if col_name:
                svc = await db[col_name].find_one(
                    {"$or": [{"_id": order_data.service_id}, {"id": order_data.service_id}]},
                    {"operator_id": 1, "operator_name": 1}
                )
                if svc:
                    operator_id = svc.get("operator_id")
                    operator_name = operator_name or svc.get("operator_name", "")

    # Pull the operator's logo so the customer's order detail / e-ticket can
    # render the real brand instead of a generic monogram.
    operator_logo_url = None
    if operator_id:
        op_logo_doc = await db.operators.find_one({"_id": operator_id}, {"logo_url": 1})
        if op_logo_doc:
            operator_logo_url = op_logo_doc.get("logo_url")

    # ── Anti-self-booking safeguard ────────────────────────────────────────
    # Operators (owners + team members) must not book in their own name —
    # either as a customer self-booking on /services/*/booking (blocked at
    # the frontend) OR disguised as a "walk-in" customer carrying their own
    # email/phone. We reject the order when the customer's email or phone
    # matches the operator owner's contact details.
    if operator_id:
        op_doc = await db.operators.find_one(
            {"_id": operator_id},
            {"_id": 0, "email": 1, "phone": 1, "owner_user_id": 1, "business_name": 1, "name": 1}
        )
        if op_doc:
            owner_email = (op_doc.get("email") or "").strip().lower()
            owner_phone = "".join(ch for ch in (op_doc.get("phone") or "") if ch.isdigit())
            # The owner's user record (additional fallback for emails diverged from the operator doc)
            owner_user = None
            if op_doc.get("owner_user_id"):
                owner_user = await db.users.find_one(
                    {"_id": op_doc["owner_user_id"]},
                    {"_id": 0, "email": 1, "phone": 1}
                )
            owner_user_email = ((owner_user or {}).get("email") or "").strip().lower()
            owner_user_phone = "".join(ch for ch in ((owner_user or {}).get("phone") or "") if ch.isdigit())
            forbidden_emails = {e for e in (owner_email, owner_user_email) if e}
            forbidden_phones = {p for p in (owner_phone, owner_user_phone) if p}
            customer_email = ((booking_details.get("customer_email") or "")).strip().lower()
            customer_phone = "".join(ch for ch in (booking_details.get("customer_phone") or "") if ch.isdigit())
            if forbidden_emails and customer_email and customer_email in forbidden_emails:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An operator cannot book services for themselves. Please use a different customer email."
                )
            if forbidden_phones and customer_phone and customer_phone in forbidden_phones:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An operator cannot book services for themselves. Please use a different customer phone."
                )
            # Also block if the logged-in user IS the operator owner and is trying
            # to set themselves as customer (covers the disguised customer-mode case).
            if op_doc.get("owner_user_id") == user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Operators cannot book their own services."
                )

    # Enrich travel bookings with vehicle info so the customer ticket can display it
    if order_data.service_type == "travel" and order_data.service_id:
        try:
            route = await db.travel_routes.find_one(
                {"$or": [{"_id": order_data.service_id}, {"id": order_data.service_id}]},
                {"vehicle_id": 1, "from_city": 1, "to_city": 1, "departure_time": 1, "arrival_time": 1},
            )
            if route and route.get("vehicle_id"):
                vehicle = await db.vehicles.find_one(
                    {"$or": [{"_id": route["vehicle_id"]}, {"id": route["vehicle_id"]}]},
                    {"_id": 0, "plate_number": 1, "vehicle_name": 1, "model": 1,
                     "manufacturer": 1, "images": 1, "vehicle_type": 1, "year": 1},
                )
                if vehicle:
                    booking_details["vehicle_info"] = vehicle
                    booking_details["vehicle_id"] = route["vehicle_id"]
                    booking_details.setdefault("from_city", route.get("from_city"))
                    booking_details.setdefault("to_city", route.get("to_city"))
                    booking_details.setdefault("departure_time", route.get("departure_time"))
                    booking_details.setdefault("arrival_time", route.get("arrival_time"))
        except Exception:
            pass

    # Enrich hotel bookings with room_id + snapshot so room-swap reassignment works
    if order_data.service_type == "hotel" and order_data.service_id and not booking_details.get("room_id"):
        try:
            # booking_details may carry a chosen room_id directly (preferred),
            # otherwise fall back to the hotel's first available room.
            room_id = booking_details.get("room_id")
            if not room_id:
                room = await db.rooms.find_one(
                    {"hotel_id": order_data.service_id,
                     "status": {"$in": ["available", None]}},
                    sort=[("base_price", 1)],
                )
                if room:
                    room_id = room.get("_id")
            if room_id:
                room = await db.rooms.find_one(
                    {"_id": room_id},
                    {"_id": 0, "room_name": 1, "room_number": 1, "room_type": 1,
                     "floor": 1, "capacity": 1, "beds": 1, "bed_type": 1,
                     "amenities": 1, "images": 1, "base_price": 1},
                )
                if room:
                    booking_details["room_id"] = room_id
                    booking_details["room_info"] = room
        except Exception:
            pass

    # Enrich car rental bookings with car snapshot
    if order_data.service_type == "car_rental" and order_data.service_id and not booking_details.get("car_info"):
        try:
            car_id = booking_details.get("car_id") or order_data.service_id
            car = await db.car_rentals.find_one(
                {"_id": car_id},
                {"_id": 0, "car_name": 1, "make": 1, "model": 1, "year": 1,
                 "plate_number": 1, "license_plate": 1, "images": 1,
                 "vehicle_type": 1, "transmission": 1, "fuel_type": 1,
                 "seats": 1, "doors": 1},
            )
            if car:
                booking_details["car_id"] = car_id
                booking_details["car_info"] = car
        except Exception:
            pass

    # Enrich event bookings with event snapshot
    if order_data.service_type == "event" and order_data.service_id and not booking_details.get("event_info"):
        try:
            event_id = booking_details.get("event_id") or order_data.service_id
            event = await db.events.find_one(
                {"_id": event_id},
                {"_id": 0, "name": 1, "event_type": 1, "venue_name": 1,
                 "venue_address": 1, "city": 1, "start_date": 1, "end_date": 1,
                 "doors_open": 1, "images": 1},
            )
            if event:
                booking_details["event_id"] = event_id
                booking_details["event_info"] = event
        except Exception:
            pass

    # Enrich package bookings with package snapshot
    if order_data.service_type == "package" and order_data.service_id and not booking_details.get("package_info"):
        try:
            pkg_id = booking_details.get("package_id") or order_data.service_id
            pkg = await db.packages.find_one(
                {"_id": pkg_id},
                {"_id": 0, "tracking_number": 1, "package_type": 1,
                 "origin_city": 1, "destination_city": 1, "weight_kg": 1,
                 "dimensions": 1, "price": 1, "status": 1},
            )
            if pkg:
                booking_details["package_id"] = pkg_id
                booking_details["package_info"] = pkg
        except Exception:
            pass

    # Enrich laundry/pressing bookings with shop snapshot
    if order_data.service_type in ("laundry", "pressing") and order_data.service_id and not booking_details.get("pressing_info"):
        try:
            pressing_id = booking_details.get("pressing_id") or booking_details.get("shop_id") or order_data.service_id
            # New shops live in db.pressings (plural); fall back to legacy db.pressing
            shop = await db.pressings.find_one(
                {"_id": pressing_id},
                {"_id": 0, "name": 1, "address": 1, "city": 1, "phone": 1,
                 "images": 1, "shop_type": 1, "item_prices": 1, "delivery_available": 1,
                 "express_available": 1, "delivery_fee": 1, "turnaround_hours": 1,
                 "operator_id": 1, "operator_name": 1},
            )
            if not shop:
                shop = await db.pressing.find_one(
                    {"_id": pressing_id},
                    {"_id": 0, "name": 1, "address": 1, "city": 1, "phone": 1,
                     "images": 1, "delivery_available": 1, "express_available": 1},
                )
            if shop:
                booking_details["pressing_id"] = pressing_id
                booking_details["pressing_info"] = shop
        except Exception:
            pass

    # Enrich cinema bookings with full showtime + cinema + film snapshot
    # so the OrderDetailModal can render rich screening info even if the
    # frontend only sends the showtime_id.
    if order_data.service_type == "cinema":
        try:
            st_id = booking_details.get("showtime_id") or order_data.service_id
            if st_id:
                st = await db.showtimes.find_one(
                    {"_id": st_id},
                    {"_id": 0, "cinema_id": 1, "cinema_name": 1, "film_id": 1,
                     "film_title": 1, "screen_name": 1, "screen_type": 1,
                     "show_date": 1, "show_time": 1, "end_time": 1,
                     "price": 1, "vip_price": 1, "language": 1, "subtitles": 1},
                )
                if st:
                    booking_details["showtime_id"] = st_id

                    # Pull the film snapshot — adds the poster + rich metadata
                    film_doc = None
                    if st.get("film_id"):
                        film_doc = await db.films.find_one(
                            {"_id": st["film_id"]},
                            {"_id": 0, "title": 1, "poster_url": 1, "duration_minutes": 1,
                             "genre": 1, "language": 1, "rating": 1, "director": 1,
                             "cast": 1, "synopsis": 1, "description": 1, "trailer_url": 1,
                             "release_date": 1, "imdb_rating": 1},
                        )

                    # Pull the cinema snapshot — adds address + amenities
                    cinema_doc = None
                    if st.get("cinema_id"):
                        cinema_doc = await db.cinemas.find_one(
                            {"_id": st["cinema_id"]},
                            {"_id": 0, "name": 1, "address": 1, "city": 1, "phone": 1,
                             "email": 1, "images": 1, "amenities": 1, "operator_id": 1,
                             "operator_name": 1},
                        )

                    # Compose a rich showtime_info that the modal already
                    # consumes via si.* lookups.
                    info = dict(st)
                    if cinema_doc:
                        info["cinema_address"] = cinema_doc.get("address")
                        info["cinema_city"] = cinema_doc.get("city")
                        info["cinema_phone"] = cinema_doc.get("phone")
                        info["cinema_amenities"] = cinema_doc.get("amenities") or []
                        info["cinema_images"] = cinema_doc.get("images") or []
                    if film_doc:
                        info["film_title"] = info.get("film_title") or film_doc.get("title")
                        info["poster_url"] = film_doc.get("poster_url")
                        info["film_duration_minutes"] = film_doc.get("duration_minutes")
                        info["film_genre"] = film_doc.get("genre") or []
                        info["film_language"] = film_doc.get("language")
                        info["film_rating"] = film_doc.get("rating")
                        info["film_director"] = film_doc.get("director")
                        info["film_cast"] = film_doc.get("cast") or []
                        info["film_synopsis"] = film_doc.get("synopsis") or film_doc.get("description")
                        info["film_trailer_url"] = film_doc.get("trailer_url")
                        info["film_imdb_rating"] = film_doc.get("imdb_rating")
                    booking_details["showtime_info"] = info
        except Exception:
            pass
    
    if is_round_trip:
        # Create 2 separate orders (tickets) for round trip
        trip_group_id = str(uuid.uuid4())
        outbound_id = str(uuid.uuid4())
        return_id = str(uuid.uuid4())
        
        outbound_number = f"{service_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        return_number = f"{service_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Split pricing between legs
        outbound_details = {**booking_details}
        outbound_details.pop("return_date", None)
        outbound_details["leg"] = "outbound"
        
        return_details = {**booking_details}
        return_details["leg"] = "return"
        
        # Calculate per-leg amounts from booking_details if possible
        outbound_price = booking_details.get("outbound_price", order_data.total_amount / 2)
        return_price = order_data.total_amount - outbound_price
        
        outbound_order = {
            "_id": outbound_id,
            "order_number": outbound_number,
            "user_id": user_id,
            "user_email": current_user.get("email", ""),
            "service_type": order_data.service_type,
            "service_category": order_data.service_type,
            "service_id": order_data.service_id,
            "service_name": f"{order_data.service_name} (Outbound)",
            "operator_id": operator_id,
            "operator_name": operator_name,
            "operator_logo_url": operator_logo_url,
            "subtotal": outbound_price,
            "total_amount": outbound_price,
            "final_amount": outbound_price,
            "currency": order_data.currency,
            "status": order_data.status,
            "payment_status": order_data.payment_status,
            "booking_details": outbound_details,
            "trip_group_id": trip_group_id,
            "trip_leg": "outbound",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        return_order = {
            "_id": return_id,
            "order_number": return_number,
            "user_id": user_id,
            "user_email": current_user.get("email", ""),
            "service_type": order_data.service_type,
            "service_category": order_data.service_type,
            "service_id": order_data.service_id,
            "service_name": f"{order_data.service_name} (Return)",
            "operator_id": operator_id,
            "operator_name": operator_name,
            "operator_logo_url": operator_logo_url,
            "subtotal": return_price,
            "total_amount": return_price,
            "final_amount": return_price,
            "currency": order_data.currency,
            "status": order_data.status,
            "payment_status": order_data.payment_status,
            "booking_details": return_details,
            "trip_group_id": trip_group_id,
            "trip_leg": "return",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.orders.insert_many([outbound_order, return_order])
        # Live rollup increment for both legs.
        try:
            from utils.analytics_rollup import increment_rollup
            for _ord in (outbound_order, return_order):
                await increment_rollup(
                    db,
                    operator_id=_ord.get("operator_id"),
                    service_category=_ord.get("service_category") or _ord.get("service_type"),
                    status=_ord.get("status", "pending"),
                    amount=_ord.get("total_amount", 0),
                    created_at=_ord.get("created_at"),
                )
        except Exception as _exc:  # noqa: BLE001
            logging.getLogger(__name__).debug("rollup increment skipped: %s", _exc)
        
        # Create a single receipt for both legs
        receipt_number = f"RCT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        receipt = {
            "_id": str(uuid.uuid4()),
            "receipt_number": receipt_number,
            "user_id": user_id,
            "user_email": current_user.get("email", ""),
            "order_ids": [outbound_id, return_id],
            "trip_group_id": trip_group_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "total_amount": order_data.total_amount,
            "currency": order_data.currency,
            "service_type": order_data.service_type,
            "description": f"Round Trip: {order_data.service_name}",
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        }
        await db.receipts.insert_one(receipt)
        
        result = {
            "success": True,
            "message": "Round trip orders created (2 tickets, 1 receipt)",
            "order_id": outbound_id,
            "return_order_id": return_id,
            "trip_group_id": trip_group_id,
            "receipt_number": receipt_number,
            "order_number": outbound_number,
            "return_order_number": return_number,
            "total_amount": order_data.total_amount
        }
        if idempotency_key:
            await _store_idempotency(db, user_id, idempotency_key, result)
        return result
    
    # Single trip order
    order_number = f"{service_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    subtotal = order_data.total_amount
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": user_id,
        "user_email": current_user.get("email", ""),
        "service_type": order_data.service_type,
        "service_category": order_data.service_type,
        "service_id": order_data.service_id,
        "service_name": order_data.service_name,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "operator_logo_url": operator_logo_url,
        "subtotal": subtotal,
        "tax": 0,
        "discount": booking_details.get("promo_discount", 0),
        "total_amount": order_data.total_amount,
        "final_amount": order_data.total_amount,
        "currency": order_data.currency,
        "status": order_data.status,
        "payment_status": order_data.payment_status,
        "booking_details": order_data.booking_details,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.orders.insert_one(order)
    # Live rollup increment.
    try:
        from utils.analytics_rollup import increment_rollup
        await increment_rollup(
            db,
            operator_id=order.get("operator_id"),
            service_category=order.get("service_category") or order.get("service_type"),
            status=order.get("status", "pending"),
            amount=order.get("total_amount", 0),
            created_at=order.get("created_at"),
        )
    except Exception as _exc:  # noqa: BLE001
        logging.getLogger(__name__).debug("rollup increment skipped: %s", _exc)

    # Fan-out notifications: operator team + admins/superadmins.
    # Best-effort, never blocks order creation.
    try:
        await _notify_new_booking(db, order)
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("notify_new_booking failed: %s", exc)

    result = {
        "success": True,
        "message": "Order created successfully",
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "total_amount": order_data.total_amount
    }
    if idempotency_key:
        await _store_idempotency(db, user_id, idempotency_key, result)
    return result


async def _store_idempotency(db, user_id: str, key: str, response: dict) -> None:
    """Persist the (user_id, Idempotency-Key) -> response mapping.

    Expires automatically after IDEMPOTENCY_TTL_HOURS via the TTL index that
    `utils.startup_indexes` ensures on boot (or — if we forget that — Mongo
    just keeps the docs forever; the TTL index makes them self-clean)."""
    try:
        await db.idempotency_keys.insert_one({
            "_id": f"{user_id}:{key}",
            "user_id": user_id,
            "idempotency_key": key,
            "response": response,
            "created_at": datetime.now(timezone.utc),
            # TTL anchor — the startup_indexes module installs an expireAfterSeconds=0
            # index on this field so Mongo evicts the doc once `expires_at`
            # is in the past.
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=IDEMPOTENCY_TTL_HOURS),
        })
    except Exception as exc:  # noqa: BLE001
        # If insert collides on a race (two parallel inserts) we simply lose
        # the cache for this key — the order is already created so the
        # second writer's response is fine to return as-is.
        logging.getLogger(__name__).debug("idempotency_keys insert skipped: %s", exc)


async def _notify_new_booking(db, order: dict):
    """Notify operator team + admins/superadmins of a new booking.

    Operators receive "New booking received" so they can prepare the service.
    Admins/superadmins receive "Pending validation" so they can review.
    Safe to call on every order — recipients are deduped on user_id.
    """
    order_id = order["_id"]
    order_number = order.get("order_number", "")
    service_type = order.get("service_type", "service")
    service_name = order.get("service_name", "Service")
    total_amount = order.get("total_amount", 0)
    currency = order.get("currency", "XAF")
    operator_id = order.get("operator_id")
    operator_name = order.get("operator_name", "")

    now = datetime.now(timezone.utc)
    notifications: list = []
    user_ids_added: set = set()

    def _push(user_id: str, title: str, message: str, ntype: str):
        if not user_id or user_id in user_ids_added:
            return
        user_ids_added.add(user_id)
        notifications.append({
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": ntype,
            "source": "booking",
            "order_id": order_id,
            "order_number": order_number,
            "service_type": service_type,
            "is_read": False,
            "created_at": now,
        })

    # 1. Notify the operator team
    if operator_id:
        op_message = f"New {service_type} booking #{order_number} for {service_name} ({total_amount:,.0f} {currency})."
        # Owner of the operator
        operator_doc = await db.operators.find_one(
            {"_id": operator_id},
            {"owner_user_id": 1, "user_id": 1, "primary_user_id": 1},
        )
        if operator_doc:
            for key in ("owner_user_id", "user_id", "primary_user_id"):
                uid = operator_doc.get(key)
                if uid:
                    _push(uid, "New Booking Received", op_message, "new_booking")
        # Team members scoped to this operator
        async for team_user in db.users.find(
            {"operator_id": operator_id, "is_active": {"$ne": False}},
            {"_id": 1},
        ):
            _push(team_user["_id"], "New Booking Received", op_message, "new_booking")

    # 2. Notify admins + super admins
    admin_message = (
        f"New {service_type} booking #{order_number} pending validation"
        + (f" for {operator_name}" if operator_name else "")
        + f" — {total_amount:,.0f} {currency}."
    )
    async for admin in db.users.find(
        {"role": {"$in": ["admin", "super_admin", "superadmin"]}, "is_active": {"$ne": False}},
        {"_id": 1},
    ):
        _push(admin["_id"], "Booking Awaiting Validation", admin_message, "validation_required")

    if notifications:
        await db.notifications.insert_many(notifications)


@router.get("/")
async def get_user_orders(
    current_user: dict = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    operator_id: Optional[str] = None,
):
    """Get orders - Admin sees all (optionally filtered by operator_id), operators see their own."""
    db = get_database()
    
    user_role = current_user.get("role", "customer")
    user_id = current_user.get("id") or current_user.get("_id")
    
    # Admin and super_admin can see all orders, optionally filtered by operator_id
    if user_role in ["admin", "super_admin"]:
        query = {"operator_id": operator_id} if operator_id else {}
    # Operators see orders for their services
    elif user_role == "operator" or current_user.get("operator_id"):
        op_id = current_user.get("operator_id")
        if op_id:
            query = {"$or": [
                {"user_id": user_id},
                {"operator_id": op_id}
            ]}
        else:
            query = {"user_id": user_id}
    else:
        # Customers see only their own orders
        query = {"user_id": user_id}
    
    orders_cursor = db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = await orders_cursor.to_list(limit)
    total = await db.orders.count_documents(query)
    
    # Process orders to ensure they have an 'id' field and no '_id'
    processed_orders = []
    for order in orders:
        # Use 'id' if exists, otherwise use '_id' converted to string, or order_number as fallback
        order_id = order.get("id") or str(order.get("_id", "")) or order.get("order_number")
        processed_order = {k: v for k, v in order.items() if k != "_id"}
        processed_order["id"] = order_id
        
        # Get customer name for admin view
        if user_role in ["admin", "super_admin"] and order.get("user_id"):
            customer = await db.users.find_one({"_id": order["user_id"]}, {"full_name": 1, "email": 1})
            if customer:
                processed_order["customer_name"] = customer.get("full_name", "Unknown")
                processed_order["customer_email"] = customer.get("email", "")
        
        # Backfill missing route-derived fields so the ticket always reflects
        # what the customer actually booked (older orders had nulls).
        processed_order = await _enrich_order_with_route(processed_order, db)

        processed_orders.append(processed_order)
    
    return {
        "orders": processed_orders,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific order"""
    db = get_database()
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check authorization
    if order["user_id"] != current_user["_id"] and current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this order"
        )
    
    # Normalize id and drop raw _id; backfill route-derived fields.
    order_id_val = order.get("id") or str(order.get("_id", "")) or order.get("order_number")
    order = {k: v for k, v in order.items() if k != "_id"}
    order["id"] = order_id_val
    order = await _enrich_order_with_route(order, db)

    # Backfill operator_logo_url for legacy orders created before iter 235.
    if not order.get("operator_logo_url") and order.get("operator_id"):
        op_doc = await db.operators.find_one({"_id": order["operator_id"]}, {"logo_url": 1})
        if op_doc and op_doc.get("logo_url"):
            order["operator_logo_url"] = op_doc["logo_url"]

    return order

@router.put("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Cancel an order"""
    db = get_database()
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order["user_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this order"
        )
    
    if order["status"] in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel this order"
        )
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "status": OrderStatus.CANCELLED,
            "cancelled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    # Rollup transition: decrement the OLD bucket (status was non-cancelled),
    # increment the new "cancelled" bucket. Keeps the rollup eventually
    # consistent with no nightly rebuild needed.
    try:
        from utils.analytics_rollup import increment_rollup
        cat = order.get("service_category") or order.get("service_type")
        amt = order.get("total_amount", 0)
        await increment_rollup(
            db, operator_id=order.get("operator_id"), service_category=cat,
            status=order.get("status"), amount=-amt, orders_delta=-1,
            created_at=order.get("created_at"),
        )
        await increment_rollup(
            db, operator_id=order.get("operator_id"), service_category=cat,
            status=OrderStatus.CANCELLED.value if hasattr(OrderStatus.CANCELLED, "value") else "cancelled",
            amount=amt, orders_delta=1, created_at=order.get("created_at"),
        )
    except Exception as _exc:  # noqa: BLE001
        logging.getLogger(__name__).debug("rollup cancel-delta skipped: %s", _exc)


@router.delete("/{order_id}/abandon")
async def abandon_pending_order(
    order_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Hard-delete a pending unpaid order the user is walking away from.

    Used when the customer closes the payment modal without paying — keeps
    `db.orders` clean of orphaned "pending" rows that would otherwise pile
    up forever. Refuses to delete anything already paid or in-flight.
    """
    db = get_database()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        # Idempotent — already gone is success
        return {"success": True, "already_gone": True}
    if order.get("user_id") != current_user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your order")
    # Only allow abandon while the order is still pending + unpaid.
    payment_status = (order.get("payment_status") or "pending").lower()
    order_status = (order.get("status") or "pending").lower()
    if payment_status in ("paid", "verified", "captured", "succeeded", "completed", "processing") or order_status in (
        "completed",
        "confirmed",
        "in_progress",
        "paid",
        "cancelled",
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order is already paid or processed — cannot abandon",
        )
    await db.orders.delete_one({"_id": order_id})
    return {"success": True, "deleted": True}


@router.get("/analytics/payment-methods")
async def get_payment_methods_analytics(
    time_range: str = Query("30d", description="Time range: today, 7d, 30d, 90d, 1y"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get payment methods breakdown - role-filtered for operators"""
    db = get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    days_map = {"today": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(time_range, 30)
    start_date = now - timedelta(days=days)
    
    # Build query based on user role
    user_role = current_user.get("role")
    query = {"created_at": {"$gte": start_date}}
    
    # Operators only see their orders
    if user_role == "operator":
        operator_id = current_user.get("operator_id")
        if operator_id:
            query["operator_id"] = operator_id
    
    # Aggregate payment methods
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$payment_method",
            "total_amount": {"$sum": "$total_amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    
    results = await db.orders.aggregate(pipeline).to_list(20)
    
    # Calculate totals
    grand_total = sum(r.get("total_amount", 0) for r in results)
    total_orders = sum(r.get("count", 0) for r in results)
    
    # Payment method display names and colors
    method_config = {
        "mtn_momo": {"name": "MTN Mobile Money", "color": "bg-yellow-500"},
        "orange_money": {"name": "Orange Money", "color": "bg-orange-500"},
        "stripe": {"name": "Card Payment", "color": "bg-blue-500"},
        "bank_transfer": {"name": "Bank Transfer", "color": "bg-gray-500"},
        "cash": {"name": "Cash", "color": "bg-green-500"},
        None: {"name": "Not Specified", "color": "bg-slate-400"},
    }
    
    payment_methods = []
    for r in results:
        method_key = r.get("_id")
        config = method_config.get(method_key, {"name": str(method_key or "Unknown").replace("_", " ").title(), "color": "bg-slate-400"})
        amount = r.get("total_amount", 0)
        percentage = round((amount / grand_total * 100), 1) if grand_total > 0 else 0
        
        payment_methods.append({
            "method": config["name"],
            "method_key": method_key,
            "amount": amount,
            "count": r.get("count", 0),
            "percentage": percentage,
            "color": config["color"]
        })
    
    # If no data, return default structure with zeros
    if not payment_methods:
        payment_methods = [
            {"method": "MTN Mobile Money", "method_key": "mtn_momo", "amount": 0, "count": 0, "percentage": 0, "color": "bg-yellow-500"},
            {"method": "Orange Money", "method_key": "orange_money", "amount": 0, "count": 0, "percentage": 0, "color": "bg-orange-500"},
            {"method": "Card Payment", "method_key": "stripe", "amount": 0, "count": 0, "percentage": 0, "color": "bg-blue-500"},
            {"method": "Bank Transfer", "method_key": "bank_transfer", "amount": 0, "count": 0, "percentage": 0, "color": "bg-gray-500"},
        ]
    
    return {
        "payment_methods": payment_methods,
        "total_revenue": grand_total,
        "total_orders": total_orders,
        "time_range": time_range
    }


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


@router.put("/{order_id}")
async def update_order(
    order_id: str,
    update_data: OrderUpdate,
    current_user: dict = Depends(require_any_permission(["orders.edit", "orders.view_all"]))
):
    """Update an order - requires orders.edit permission"""
    db = get_database()

    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()

    await db.orders.update_one({"_id": order_id}, {"$set": update_dict})

    return {"message": "Order updated successfully"}


@router.put("/{order_id}/process")
async def process_order(
    order_id: str,
    current_user: dict = Depends(require_permission("orders.process"))
):
    """Process/confirm a pending order - requires orders.process permission"""
    db = get_database()

    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be processed")

    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "status": OrderStatus.CONFIRMED,
            "processed_by": current_user.get("_id"),
            "processed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )

    return {"message": "Order processed successfully", "order_id": order_id}


# ============== TICKET SCANNING & VALIDATION ==============

class TicketScanRequest(BaseModel):
    code: str


@router.post("/scan/validate")
async def validate_ticket_scan(
    data: TicketScanRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Validate a ticket by order_number. Returns full ticket details.
    Operators only see tickets for their services.
    """
    db = get_database()
    code = data.code.strip().upper()

    # Look up by order_number or _id
    order = await db.orders.find_one({
        "$or": [
            {"order_number": {"$regex": f"^{code}$", "$options": "i"}},
            {"_id": code},
        ]
    })

    if not order:
        return {"valid": False, "code": code, "message": "Ticket not found. Check the code and try again."}

    # Operator scoping — only validate tickets for their own services
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")
        if op_id and order.get("operator_id") and order["operator_id"] != op_id:
            return {"valid": False, "code": code, "message": "This ticket belongs to a different operator."}

    # Get customer info
    customer = await db.users.find_one({"_id": order.get("user_id")}, {"full_name": 1, "email": 1, "phone": 1})
    customer_name = customer.get("full_name", "Unknown") if customer else "Unknown"
    customer_email = customer.get("email", "") if customer else ""
    customer_phone = customer.get("phone", "") if customer else ""

    booking = order.get("booking_details") or {}
    order_id = order.get("id") or str(order.get("_id", ""))

    # Prefer the most-recently-updated label coming from booking_details (which
    # is what a "replace/swap" mutates). Falls back to top-level service_name.
    # This guarantees the scanner shows fresh data after a ticket is updated.
    fresh_service_name = (
        booking.get("vehicle_name")
        or booking.get("room_name")
        or booking.get("car_name")
        or booking.get("event_name")
        or booking.get("showtime_label")
        or order.get("service_name", "")
    )
    last_reassign = (order.get("reassignment_history") or [])[-1] if order.get("reassignment_history") else None

    return {
        "valid": True,
        "code": order.get("order_number") or order_id,
        "order_id": order_id,
        "status": order.get("status", "unknown"),
        "payment_status": order.get("payment_status", "unknown"),
        "checked_in": order.get("checked_in", False),
        "checked_in_at": order.get("checked_in_at"),
        "service_type": order.get("service_type", ""),
        "service_name": fresh_service_name,
        "last_reassignment": last_reassign,
        "updated_at": order.get("updated_at").isoformat() if hasattr(order.get("updated_at", ""), "isoformat") else str(order.get("updated_at", "")),
        "operator_name": order.get("operator_name", ""),
        "total_amount": order.get("total_amount", 0),
        "currency": order.get("currency", "XAF"),
        "created_at": order.get("created_at").isoformat() if hasattr(order.get("created_at", ""), "isoformat") else str(order.get("created_at", "")),
        "customer": {
            "name": customer_name,
            "email": customer_email,
            "phone": customer_phone,
        },
        "booking": {
            "departure_city": booking.get("departure_city", booking.get("origin", "")),
            "destination_city": booking.get("destination_city", booking.get("destination", "")),
            "travel_date": booking.get("travel_date", ""),
            "departure_time": booking.get("departure_time", ""),
            "arrival_time": booking.get("arrival_time", ""),
            "operator_name": booking.get("operator_name", order.get("operator_name", "")),
            "seats": booking.get("selected_seats", booking.get("seats", [])),
            "passengers": booking.get("passengers", []),
            "is_round_trip": booking.get("is_round_trip", False),
            "leg": booking.get("leg", ""),
        },
    }


@router.post("/scan/check-in")
async def check_in_ticket(
    data: TicketScanRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Mark a ticket as checked-in. Only confirmed/paid tickets can be checked in.
    Operators can only check in tickets for their own services.
    """
    db = get_database()
    code = data.code.strip().upper()

    order = await db.orders.find_one({
        "$or": [
            {"order_number": {"$regex": f"^{code}$", "$options": "i"}},
            {"_id": code},
        ]
    })

    if not order:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Operator scoping
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")
        if op_id and order.get("operator_id") and order["operator_id"] != op_id:
            raise HTTPException(status_code=403, detail="This ticket belongs to a different operator")

    # Check if already checked in
    if order.get("checked_in"):
        raise HTTPException(status_code=400, detail=f"Ticket already checked in at {order.get('checked_in_at', 'unknown time')}")

    # Only confirmed/paid tickets can be checked in
    if order.get("status") not in ("confirmed",) or order.get("payment_status") not in ("paid", "verified"):
        raise HTTPException(status_code=400, detail=f"Cannot check in — ticket status: {order.get('status')}, payment: {order.get('payment_status')}")

    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {
            "checked_in": True,
            "checked_in_at": datetime.now(timezone.utc).isoformat(),
            "checked_in_by": current_user.get("_id") or current_user.get("id"),
            "checked_in_by_name": current_user.get("full_name", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Notify the customer (in-app) that they've been checked in. The Notifications
    # bell + email digest will pick this up automatically.
    try:
        if order.get("user_id"):
            await db.notifications.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": order["user_id"],
                "type": "ticket_checked_in",
                "title": "You've been checked in!",
                "message": f"Welcome to {order.get('service_name') or order.get('operator_name') or 'your booking'}. Enjoy!",
                "data": {
                    "order_id": order.get("id") or order["_id"],
                    "order_number": order.get("order_number"),
                    "service_name": order.get("service_name"),
                    "operator_name": order.get("operator_name"),
                    "checked_in_at": datetime.now(timezone.utc).isoformat(),
                },
                "read": False,
                "created_at": datetime.now(timezone.utc),
            })
    except Exception as exc:
        # Non-fatal — the check-in itself already succeeded.
        print(f"[check-in] failed to notify customer: {exc}")

    return {
        "message": "Ticket checked in successfully",
        "order_number": order.get("order_number"),
        "checked_in_at": datetime.now(timezone.utc).isoformat(),
    }
