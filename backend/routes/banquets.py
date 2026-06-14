from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.banquet import BanquetCreate, BanquetUpdate, BanquetStatus
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/banquets", tags=["Banquets"])

# Sub-router for /api/banquets/packages — declared as its own router so its
# routes are matched BEFORE the dynamic `/{banquet_id}` paths on `router`.
# (FastAPI matches in include-order; a literal-prefix router included
# explicitly before the parent always wins over the dynamic param.)
packages_router = APIRouter(prefix="/api/banquets/packages", tags=["Banquets · Packages"])

@router.post("/")
async def create_banquet(
    banquet_data: BanquetCreate,
    current_user: dict = Depends(require_any_permission(["banquets.create", "operator.services.create"]))
):
    """Create a new banquet venue - requires banquets.create permission"""
    db = get_database()
    
    operator_id = banquet_data.operator_id or current_user.get("operator_id")
    operator_name = banquet_data.operator_name or current_user.get("operator_name", "")
    
    banquet = {
        "_id": str(uuid.uuid4()),
        **banquet_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": BanquetStatus.ACTIVE,
        "rating": 0,
        "total_reviews": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.banquets.insert_one(banquet)
    
    return {"message": "Banquet venue created", "banquet_id": banquet["_id"]}

@router.get("/")
async def get_banquets(
    city: Optional[str] = None,
    country: Optional[str] = None,
    venue_type: Optional[str] = None,
    category: Optional[str] = None,
    capacity_min: Optional[int] = None,
    capacity_max: Optional[int] = None,
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get event services (banquets, rental items, talent, catering, …).

    `category` filters to a single service type: hall, rental_item, canopy,
    photographer, videographer, catering, decoration, sound_lighting, other.
    """
    db = get_database()
    
    query = {"status": BanquetStatus.ACTIVE}
    
    if operator_id:
        query["operator_id"] = operator_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if venue_type:
        query["venue_type"] = venue_type
    if category:
        query["category"] = category
    if capacity_min:
        query["capacity_max"] = {"$gte": capacity_min}
    if capacity_max:
        query["capacity_min"] = {"$lte": capacity_max}
    
    # Apply country filter via operator lookup (banquets has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        query.update(op_filter)
    
    banquets = await db.banquets.find(query).sort("rating", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.banquets.count_documents(query)
    
    # Transform _id to id for each banquet
    for banquet in banquets:
        banquet["id"] = str(banquet.pop("_id", ""))

    # --- FOMO inventory enrichment ---------------------------------------
    # Banquets are typically single-event-per-day venues. We expose
    # `slots_available` = number of free days in the upcoming 30-day window
    # (today + 29). A day is "taken" if there's an active banquet order whose
    # `booking_details.date` falls on it. Field is only emitted for venues
    # whose orders actually intersect the window (and capped at 30).
    if banquets:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        window_iso_dates = {(today + timedelta(days=i)).date().isoformat() for i in range(30)}
        banquet_ids = [b["id"] for b in banquets]
        bookings = await db.orders.find({
            "service_category": "banquet",
            "service_id": {"$in": banquet_ids},
            "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
        }, {"_id": 0, "service_id": 1, "booking_details.date": 1}).to_list(None)
        taken_by_venue: dict = {}
        for o in bookings:
            sid = o.get("service_id")
            date_str = (o.get("booking_details") or {}).get("date")
            if sid and date_str and date_str in window_iso_dates:
                taken_by_venue.setdefault(sid, set()).add(date_str)
        for b in banquets:
            taken = len(taken_by_venue.get(b["id"], set()))
            b["slots_available"] = max(0, 30 - taken)
    
    return {"banquets": banquets, "total": total}

@router.get("/{banquet_id}")
async def get_banquet(banquet_id: str):
    """Get banquet venue details"""
    db = get_database()
    banquet = await db.banquets.find_one({"_id": banquet_id})
    if not banquet:
        raise HTTPException(status_code=404, detail="Banquet venue not found")
    banquet["id"] = banquet.pop("_id")
    return banquet

@router.put("/{banquet_id}")
async def update_banquet(
    banquet_id: str,
    banquet_data: BanquetUpdate,
    current_user: dict = Depends(require_any_permission(["banquets.edit", "operator.services.edit"]))
):
    """Update a banquet venue - requires banquets.edit permission"""
    db = get_database()
    
    banquet = await db.banquets.find_one({"_id": banquet_id})
    if not banquet:
        raise HTTPException(status_code=404, detail="Banquet venue not found")
    
    if current_user["role"] == "operator" and banquet["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in banquet_data.dict().items() if v is not None}
    
    if current_user["role"] == "operator":
        update_data.pop("status", None)
        if {k for k in update_data if k not in ("updated_at",)}:
            update_data["status"] = "pending"
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.banquets.update_one({"_id": banquet_id}, {"$set": update_data})
    
    return {"message": "Banquet venue updated"}

@router.delete("/{banquet_id}")
async def delete_banquet(
    banquet_id: str,
    current_user: dict = Depends(require_any_permission(["banquets.delete", "operator.services.delete"]))
):
    """Delete a banquet venue - requires banquets.delete permission"""
    db = get_database()
    
    banquet = await db.banquets.find_one({"_id": banquet_id})
    if not banquet:
        raise HTTPException(status_code=404, detail="Banquet venue not found")
    
    if current_user["role"] == "operator" and banquet["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.banquets.delete_one({"_id": banquet_id})
    
    return {"message": "Banquet venue deleted"}

@router.get("/{banquet_id}/availability")
async def check_availability(
    banquet_id: str,
    date: str
):
    """Check banquet availability for a date"""
    db = get_database()
    
    banquet = await db.banquets.find_one({"_id": banquet_id})
    if not banquet:
        raise HTTPException(status_code=404, detail="Banquet venue not found")
    
    # Check existing bookings
    existing = await db.banquet_bookings.find_one({
        "banquet_id": banquet_id,
        "event_date": date,
        "status": {"$in": ["reserved", "confirmed"]}
    })
    
    return {
        "banquet_id": banquet_id,
        "date": date,
        "available": existing is None,
        "existing_booking": existing is not None
    }

@router.post("/{banquet_id}/book")
async def book_banquet(
    banquet_id: str,
    event_date: str,
    event_type: str,
    expected_guests: int,
    package_name: Optional[str] = None,
    catering_option: Optional[str] = None,
    additional_services: List[str] = [],
    contact_name: str = "",
    contact_phone: str = "",
    contact_email: str = "",
    special_requests: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Book a banquet venue"""
    db = get_database()
    
    banquet = await db.banquets.find_one({"_id": banquet_id})
    if not banquet:
        raise HTTPException(status_code=404, detail="Banquet venue not found")
    
    # Check availability
    existing = await db.banquet_bookings.find_one({
        "banquet_id": banquet_id,
        "event_date": event_date,
        "status": {"$in": ["reserved", "confirmed"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Venue not available for selected date")
    
    # Check advance booking
    event_datetime = datetime.fromisoformat(event_date)
    min_advance = banquet.get("advance_booking_days", 7)
    if event_datetime < datetime.utcnow() + timedelta(days=min_advance):
        raise HTTPException(
            status_code=400,
            detail=f"Booking requires at least {min_advance} days advance notice"
        )
    
    # Calculate price
    base_price = banquet.get("base_price", 0)
    if banquet.get("price_type") == "per_person":
        base_price = base_price * expected_guests
    
    # Add package price
    package_price = 0
    if package_name:
        package = next((p for p in banquet.get("packages", []) if p["name"] == package_name), None)
        if package:
            package_price = package.get("price", 0)
    
    # Add catering
    catering_price = 0
    if catering_option:
        catering = next((c for c in banquet.get("catering_options", []) if c["name"] == catering_option), None)
        if catering:
            catering_price = catering.get("price_per_person", 0) * expected_guests
    
    total_price = base_price + package_price + catering_price
    
    banquet_booking_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "banquet"})
    order_number = f"BNQ-{order_count + 1:06d}"
    
    # Create service-specific booking
    booking = {
        "_id": banquet_booking_id,
        "order_id": order_id,  # Link to central order
        "banquet_id": banquet_id,
        "banquet_name": banquet["name"],
        "user_id": current_user["_id"],
        "event_date": event_date,
        "event_type": event_type,
        "expected_guests": expected_guests,
        "package_name": package_name,
        "catering_option": catering_option,
        "additional_services": additional_services,
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "special_requests": special_requests,
        "base_price": base_price,
        "package_price": package_price,
        "catering_price": catering_price,
        "total_price": total_price,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.banquet_bookings.insert_one(booking)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "banquet",
        "service_booking_id": banquet_booking_id,
        "service_name": f"Banquet - {banquet['name']}",
        "service_id": banquet_id,
        "user_id": current_user["_id"],
        "operator_id": banquet.get("operator_id"),
        "operator_name": banquet.get("operator_name"),
        "total_amount": total_price,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "event_date": event_date,
            "event_type": event_type,
            "expected_guests": expected_guests,
            "contact_name": contact_name,
            "contact_phone": contact_phone
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    return {
        "message": "Venue reserved",
        "booking_id": banquet_booking_id,
        "order_id": order_id,
        "order_number": order_number,
        "total_price": total_price
    }

@router.get("/bookings/my")
async def get_my_banquet_bookings(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's banquet bookings"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    bookings = await db.banquet_bookings.find(query, {"_id": 0}).sort("event_date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.banquet_bookings.count_documents(query)
    
    return {"bookings": bookings, "total": total}



@router.get("/management/my-venues")
async def get_my_venues(
    search: Optional[str] = None,
    city: Optional[str] = None,
    venue_type: Optional[str] = None,
    category: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get event services for the current user's operator (operator-scoped).
    Super admin and admin can see all. Operator users see only their own.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    if operator_id and current_user.get("role") in ("super_admin", "admin"):
        query["operator_id"] = operator_id
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if venue_type:
        query["venue_type"] = venue_type
    if category:
        query["category"] = category
    
    venues = await db.banquets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.banquets.count_documents(query)
    
    # Transform _id to id
    for venue in venues:
        venue["id"] = str(venue.pop("_id", ""))
    
    return {
        "venues": venues, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }


# ──────────────────────────────────────────────────────────────────────
# Packages — operator-built bundles of event services
# IMPORTANT: route order matters. The /packages/* paths MUST be declared
# BEFORE the dynamic /{banquet_id} route (which lives at module top) —
# but since the dynamic route is on a *separate path component* than
# /packages/..., FastAPI's path matching disambiguates correctly. We
# still keep `/packages/` explicit (with trailing path segments) so
# `/packages` alone is not captured by `/{banquet_id}`.
# ──────────────────────────────────────────────────────────────────────

from models.banquet import BanquetPackageCreate, BanquetPackageUpdate  # noqa: E402


def _bundle_total_from_services(svc_docs: list, lines: list) -> float:
    """Sum (line.quantity × service.base_price) for a bundle."""
    by_id = {s["_id"]: s for s in svc_docs}
    total = 0.0
    for line in lines:
        svc = by_id.get(line["service_id"])
        if not svc:
            continue
        total += float(svc.get("base_price", 0)) * float(line.get("quantity", 1))
    return round(total, 2)


@packages_router.post("/")
async def create_banquet_package(
    package: BanquetPackageCreate,
    current_user: dict = Depends(require_any_permission(["banquets.create", "operator.services.create"])),
):
    """Create an event-services bundle (Wedding Package, Birthday Bundle, …)."""
    db = get_database()

    operator_id = package.operator_id or current_user.get("operator_id")
    if not operator_id and current_user.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=400, detail="operator_id is required")

    service_ids = [s.service_id for s in package.services]
    if not service_ids:
        raise HTTPException(status_code=400, detail="A package must include at least one service.")
    svc_docs = await db.banquets.find({"_id": {"$in": service_ids}}).to_list(None)
    if len(svc_docs) != len(set(service_ids)):
        raise HTTPException(status_code=400, detail="One or more services in the bundle were not found.")
    if current_user.get("role") not in ("super_admin", "admin"):
        owned = {s["_id"] for s in svc_docs if s.get("operator_id") == operator_id}
        if set(service_ids) - owned:
            raise HTTPException(status_code=403, detail="You can only bundle services owned by your operator.")

    lines = [s.dict() for s in package.services]
    subtotal = _bundle_total_from_services(svc_docs, lines)
    discount = max(0.0, min(100.0, package.discount_percent)) / 100.0
    total_price = round(subtotal * (1 - discount), 2)

    doc = {
        "_id": str(uuid.uuid4()),
        "operator_id": operator_id,
        "operator_name": current_user.get("operator_name", ""),
        "name": package.name,
        "description": package.description,
        "image_url": package.image_url,
        "services": lines,
        "discount_percent": package.discount_percent,
        "subtotal": subtotal,
        "total_price": total_price,
        "is_active": package.is_active,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.banquet_packages.insert_one(doc)
    return {"message": "Package created", "package_id": doc["_id"], "subtotal": subtotal, "total_price": total_price}


@packages_router.get("/")
async def list_banquet_packages(
    operator_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """List bundles. Operators see only their own; admins see everything."""
    from middleware.auth import get_operator_filter
    db = get_database()
    query = get_operator_filter(current_user)
    if operator_id and current_user.get("role") in ("super_admin", "admin"):
        query["operator_id"] = operator_id
    if is_active is not None:
        query["is_active"] = is_active

    packages = await db.banquet_packages.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.banquet_packages.count_documents(query)

    all_svc_ids = {line["service_id"] for p in packages for line in p.get("services", [])}
    svc_docs = {}
    if all_svc_ids:
        async for s in db.banquets.find(
            {"_id": {"$in": list(all_svc_ids)}},
            {"_id": 1, "name": 1, "category": 1, "base_price": 1, "unit_label": 1, "pricing_model": 1},
        ):
            svc_docs[s["_id"]] = s

    for p in packages:
        p["id"] = str(p.pop("_id", ""))
        for line in p.get("services", []):
            svc = svc_docs.get(line["service_id"])
            if svc:
                line["service_name"] = svc.get("name")
                line["category"] = svc.get("category")
                line["base_price"] = svc.get("base_price")
                line["unit_label"] = svc.get("unit_label")
                line["pricing_model"] = svc.get("pricing_model")

    return {"packages": packages, "total": total}


@packages_router.put("/{package_id}")
async def update_banquet_package(
    package_id: str,
    package: BanquetPackageUpdate,
    current_user: dict = Depends(require_any_permission(["banquets.edit", "operator.services.edit"])),
):
    """Update a bundle. Recomputes subtotal/total when services or discount change."""
    db = get_database()
    existing = await db.banquet_packages.find_one({"_id": package_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")

    if current_user["role"] == "operator":
        if existing.get("operator_id") != (current_user.get("operator_id") or current_user.get("_id")):
            raise HTTPException(status_code=403, detail="Not authorized")

    update = {k: v for k, v in package.dict().items() if v is not None}
    if "services" in update:
        lines = [s if isinstance(s, dict) else s.dict() for s in update["services"]]
        update["services"] = lines
        svc_docs = await db.banquets.find({"_id": {"$in": [ln["service_id"] for ln in lines]}}).to_list(None)
        update["subtotal"] = _bundle_total_from_services(svc_docs, lines)
    subtotal = update.get("subtotal", existing.get("subtotal", 0.0))
    discount = update.get("discount_percent", existing.get("discount_percent", 0.0))
    discount = max(0.0, min(100.0, float(discount))) / 100.0
    update["total_price"] = round(subtotal * (1 - discount), 2)
    update["updated_at"] = datetime.utcnow()

    await db.banquet_packages.update_one({"_id": package_id}, {"$set": update})
    return {"message": "Package updated", "subtotal": update.get("subtotal"), "total_price": update["total_price"]}


@packages_router.delete("/{package_id}")
async def delete_banquet_package(
    package_id: str,
    current_user: dict = Depends(require_any_permission(["banquets.delete", "operator.services.delete"])),
):
    """Hard-delete a bundle. Booked orders keep their own line-item snapshot."""
    db = get_database()
    existing = await db.banquet_packages.find_one({"_id": package_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    if current_user["role"] == "operator":
        if existing.get("operator_id") != (current_user.get("operator_id") or current_user.get("_id")):
            raise HTTPException(status_code=403, detail="Not authorized")
    await db.banquet_packages.delete_one({"_id": package_id})
    return {"message": "Package deleted"}

