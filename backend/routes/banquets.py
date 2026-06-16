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

# Sub-router for /api/banquets/cart — same trick: separate prefix avoids
# collision with /{banquet_id}.
cart_router = APIRouter(prefix="/api/banquets/cart", tags=["Banquets · Cart"])

@router.post("/")
async def create_banquet(
    banquet_data: BanquetCreate,
    current_user: dict = Depends(require_any_permission(["banquets.create", "operator.services.create"]))
):
    """Create a new banquet venue - requires banquets.create permission"""
    db = get_database()
    
    operator_id = banquet_data.operator_id or current_user.get("operator_id")
    operator_name = banquet_data.operator_name or current_user.get("operator_name", "")

    # Validation: rental_item services MUST link to a banquet_items inventory doc.
    if banquet_data.category == "rental_item":
        if not banquet_data.linked_inventory_id:
            raise HTTPException(
                status_code=400,
                detail="Rental Item services must link to a Rental Inventory item. Create one in the Rental Inventory tab first.",
            )
        inv = await db.banquet_items.find_one({"_id": banquet_data.linked_inventory_id})
        if not inv:
            raise HTTPException(status_code=404, detail="Linked inventory item not found")
        if inv.get("operator_id") != operator_id and current_user.get("role") not in ("super_admin", "admin"):
            raise HTTPException(status_code=403, detail="Linked inventory item belongs to another operator")

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

@router.post("/{banquet_id}/auto-link-inventory")
async def auto_link_inventory(
    banquet_id: str,
    current_user: dict = Depends(require_any_permission(["banquets.edit", "operator.services.edit"])),
):
    """One-click migration for legacy rental_item Services with no linked inventory.

    Creates a `banquet_items` doc seeded from the Service's name/price/min_quantity
    and points `service.linked_inventory_id` at it. Idempotent — returns the existing
    link if one already exists.
    """
    db = get_database()
    svc = await db.banquets.find_one({"_id": banquet_id})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    if svc.get("category") != "rental_item":
        raise HTTPException(status_code=400, detail="Only Rental Item services can be linked to inventory")
    if svc.get("linked_inventory_id"):
        return {"inventory_id": svc["linked_inventory_id"], "message": "Already linked", "created": False}

    if current_user.get("role") == "operator" and svc.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    seed_total = int(svc.get("max_quantity") or svc.get("min_quantity") or 50)
    inv = {
        "_id": str(uuid.uuid4()),
        "operator_id": svc.get("operator_id"),
        "operator_name": svc.get("operator_name"),
        "name": svc.get("name"),
        "description": svc.get("description"),
        "category": (svc.get("category_details") or {}).get("item_category") or "other",
        "unit_price": float(svc.get("base_price") or 0),
        "images": svc.get("images") or [],
        "total_units": seed_total,
        "available_units": seed_total,
        "policies": [],
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.banquet_items.insert_one(inv)
    await db.banquets.update_one(
        {"_id": banquet_id},
        {"$set": {"linked_inventory_id": inv["_id"], "updated_at": datetime.utcnow()}},
    )
    return {"inventory_id": inv["_id"], "message": "Inventory created and linked", "created": True, "total_units": seed_total}


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

    # Enrich rental_item services with live `available_units` from their linked inventory.
    # The customer-facing grid uses this to display stock-aware "Only N left" badges.
    inv_ids = [b.get("linked_inventory_id") for b in banquets if b.get("linked_inventory_id")]
    if inv_ids:
        inv_map = {}
        async for inv in db.banquet_items.find(
            {"_id": {"$in": inv_ids}},
            {"_id": 1, "total_units": 1, "available_units": 1},
        ):
            inv_map[inv["_id"]] = inv
        for b in banquets:
            inv = inv_map.get(b.get("linked_inventory_id"))
            if inv:
                b["available_units"] = inv.get("available_units", 0)
                b["total_units"] = inv.get("total_units", 0)

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
    """List bundles.

    Visibility:
      • super_admin / admin: all packages, optionally filtered by operator_id.
      • operator role: scoped to their own operator (cannot peek at rivals).
      • customer role: every `is_active=true` bundle across operators —
        this is the marketplace catalogue, not a private ops view.
    """
    db = get_database()
    role = current_user.get("role", "")
    query = {}

    if role == "operator":
        # Operators see only their own bundles.
        from middleware.auth import get_operator_filter
        query = get_operator_filter(current_user)
    # admin / super_admin / customer: no implicit operator scope.

    if operator_id and role in ("super_admin", "admin"):
        query["operator_id"] = operator_id

    if is_active is not None:
        query["is_active"] = is_active
    elif role == "customer":
        # Customers should never see disabled bundles.
        query["is_active"] = True

    packages = await db.banquet_packages.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.banquet_packages.count_documents(query)

    all_svc_ids = {line["service_id"] for p in packages for line in p.get("services", [])}
    svc_docs = {}
    if all_svc_ids:
        async for s in db.banquets.find(
            {"_id": {"$in": list(all_svc_ids)}},
            {
                "_id": 1, "name": 1, "category": 1, "base_price": 1,
                "unit_label": 1, "pricing_model": 1, "images": 1,
                "description": 1, "city": 1, "address": 1,
                "capacity_min": 1, "capacity_max": 1, "duration_hours": 1,
                "min_quantity": 1, "amenities": 1, "category_details": 1,
                "phone": 1, "email": 1, "operator_id": 1, "operator_name": 1,
            },
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
                # Customer modal needs the full service shape for its
                # nested-detail dialog (photos, capacity, contact, etc.).
                line["service"] = {
                    "id": svc["_id"],
                    "name": svc.get("name"),
                    "category": svc.get("category"),
                    "base_price": svc.get("base_price"),
                    "unit_label": svc.get("unit_label"),
                    "pricing_model": svc.get("pricing_model"),
                    "images": svc.get("images") or [],
                    "description": svc.get("description"),
                    "city": svc.get("city"),
                    "address": svc.get("address"),
                    "capacity_min": svc.get("capacity_min"),
                    "capacity_max": svc.get("capacity_max"),
                    "duration_hours": svc.get("duration_hours"),
                    "min_quantity": svc.get("min_quantity"),
                    "amenities": svc.get("amenities") or [],
                    "category_details": svc.get("category_details") or {},
                    "phone": svc.get("phone"),
                    "email": svc.get("email"),
                    "operator_name": svc.get("operator_name"),
                }

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




# ──────────────────────────────────────────────────────────────────────
# Cart Checkout — single order with multiple event-service line items.
#
# The customer browses event services + packages, fills a "cart" for one
# event date, then hits checkout. We materialise one row in `orders`
# (service_category="banquet") with a flat list of line_items so the
# operator dashboard, receipts and analytics treat the whole event as a
# single revenue event. A companion `banquet_bookings` row holds the
# event-level metadata (date, guest count, contact info).
# ──────────────────────────────────────────────────────────────────────

from pydantic import BaseModel  # noqa: E402


class CartLineInput(BaseModel):
    service_id: str
    quantity: float = 1
    # DEPRECATED: legacy field from the standalone "Rentable Items" prototype.
    # The unified Service↔Inventory model resolves rental_item lines via the
    # service's linked_inventory_id; this is kept for backward compat only.
    kind: str = "service"
    # Optional hour-count override for per_hour services (e.g. "I want 6h
    # of the photographer instead of the default 4h"). Falls back to the
    # service's `duration_hours` when unset.
    hours: Optional[float] = None


class CartCheckoutRequest(BaseModel):
    event_date: str            # YYYY-MM-DD
    event_time: Optional[str] = None
    line_items: List[CartLineInput] = []
    package_ids: List[str] = []
    expected_guests: int = 0
    event_type: Optional[str] = None         # wedding, conference, etc.
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = None
    address: Optional[str] = None
    special_requests: Optional[str] = None
    # Optional client-computed adjustments. The server still recomputes
    # `subtotal` from authoritative service prices so the customer can't
    # short-pay; these fields are stored verbatim for receipts/audit.
    service_fee: Optional[float] = None
    promo_code: Optional[str] = None
    promo_discount: Optional[float] = None


def _price_line(service: dict, qty: float, hours: Optional[float]) -> tuple[float, dict]:
    """Compute the line total based on the service's pricing model.

    Returns (line_total, snapshot_dict) where snapshot_dict is the
    persistent record we store on the order so future price changes on
    the service don't retroactively alter past bookings.
    """
    base = float(service.get("base_price") or 0)
    model = service.get("pricing_model") or service.get("price_type") or "per_event"
    qty = float(qty or 1)

    if model == "per_unit":
        line_total = base * qty
        unit = service.get("unit_label") or "unit"
        rate_label = f"{int(base):,} / {unit}"
    elif model == "per_hour":
        h = hours if hours is not None else service.get("duration_hours")
        if h is None or float(h) <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"'{service.get('name')}' is priced per hour — please specify hours.",
            )
        h = float(h)
        line_total = base * h * qty
        rate_label = f"{int(base):,} / hour × {h}h"
    elif model == "per_person":
        line_total = base * qty
        rate_label = f"{int(base):,} / person"
    else:  # per_event, flat_fee
        line_total = base * qty
        rate_label = f"{int(base):,} flat"

    snapshot = {
        "service_id": service["_id"],
        "service_name": service.get("name"),
        "category": service.get("category", "hall"),
        "pricing_model": model,
        "unit_label": service.get("unit_label"),
        "quantity": qty,
        "hours": float(hours) if hours is not None else None,
        "unit_price": base,
        "line_total": round(line_total, 2),
        "rate_label": rate_label,
        "operator_id": service.get("operator_id"),
        "operator_name": service.get("operator_name"),
    }
    return round(line_total, 2), snapshot


@cart_router.post("/checkout")
async def event_cart_checkout(
    payload: CartCheckoutRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Create one order spanning multiple event services + packages.

    Validation rules:
      - event_date must be a future ISO date.
      - At least one line item OR one package must be in the cart.
      - All services + packages must exist; ones the cart references but
        the DB no longer has are surfaced as a 400 with the missing IDs.
      - Mixed operators are allowed (a wedding can pull chairs from one
        operator, a photographer from another). The order's top-level
        `operator_id` is set to the FIRST line item's operator for
        backwards-compat with operator dashboards; per-line operators
        are preserved in `booking_details.line_items`.
    """
    db = get_database()

    # 1. Validate date.
    try:
        event_dt = datetime.fromisoformat(payload.event_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="event_date must be YYYY-MM-DD")
    if event_dt.date() < datetime.utcnow().date():
        raise HTTPException(status_code=400, detail="Event date must be in the future")

    if not payload.line_items and not payload.package_ids:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # 2. Hydrate individual services + items.
    line_items_out: list[dict] = []
    subtotal = 0.0
    item_holds_to_create: list[dict] = []   # Holds for any rental_item service whose linked inventory exists.

    if payload.line_items:
        ids = [li.service_id for li in payload.line_items]
        svc_by_id = {
            s["_id"]: s
            async for s in db.banquets.find({"_id": {"$in": ids}})
        }
        missing = [sid for sid in ids if sid not in svc_by_id]
        if missing:
            raise HTTPException(status_code=400, detail=f"Services not found: {missing}")

        for li in payload.line_items:
            svc = svc_by_id[li.service_id]
            line_total, snap = _price_line(svc, li.quantity, li.hours)
            snap["source"] = "individual"
            line_items_out.append(snap)
            subtotal += line_total

            # If this is a rental_item Service linked to an inventory doc,
            # validate stock + queue a hold (created after the order is inserted).
            if svc.get("category") == "rental_item" and svc.get("linked_inventory_id"):
                inv_id = svc["linked_inventory_id"]
                qty = int(li.quantity or 1)
                # Per-Service constraints (min/max are the customer-facing rules).
                if svc.get("min_quantity") and qty < int(svc["min_quantity"]):
                    raise HTTPException(status_code=400, detail=f"'{svc['name']}' has a minimum of {svc['min_quantity']}")
                if svc.get("max_quantity") and qty > int(svc["max_quantity"]):
                    raise HTTPException(status_code=400, detail=f"'{svc['name']}' has a maximum of {svc['max_quantity']}")
                # Inventory constraint.
                from routes.inventory import _entity_available_units  # local import to avoid cycle
                avail = await _entity_available_units(db, "banquet_item", inv_id)
                if avail < qty:
                    raise HTTPException(status_code=409, detail=f"'{svc['name']}' has only {avail} units in stock right now.")
                item_holds_to_create.append({
                    "entity_id": inv_id,
                    "operator_id": svc.get("operator_id"),
                    "quantity": qty,
                    "item_name": svc.get("name"),
                    "unit_price": float(svc.get("base_price") or 0),
                })

    # 3. Hydrate packages (one bundle expands into its services with the
    # *bundle* line_total credited once; we still store the expanded
    # services so the operator sees which items were committed).
    if payload.package_ids:
        bundles = await db.banquet_packages.find(
            {"_id": {"$in": payload.package_ids}}
        ).to_list(None)
        missing = [pid for pid in payload.package_ids if pid not in {b["_id"] for b in bundles}]
        if missing:
            raise HTTPException(status_code=400, detail=f"Packages not found: {missing}")

        for bundle in bundles:
            bundle_total = float(bundle.get("total_price") or 0)
            subtotal += bundle_total

            # Hydrate inner services for the snapshot.
            inner_ids = [ln["service_id"] for ln in bundle.get("services", [])]
            inner_svcs = {
                s["_id"]: s
                async for s in db.banquets.find({"_id": {"$in": inner_ids}})
            }
            inner_lines = []
            for ln in bundle.get("services", []):
                svc = inner_svcs.get(ln["service_id"])
                if svc:
                    _, snap = _price_line(svc, ln.get("quantity", 1), None)
                    inner_lines.append(snap)
                    # Bundled rental_item services also reserve inventory.
                    if svc.get("category") == "rental_item" and svc.get("linked_inventory_id"):
                        qty = int(ln.get("quantity") or 1)
                        from routes.inventory import _entity_available_units  # local import
                        avail = await _entity_available_units(db, "banquet_item", svc["linked_inventory_id"])
                        if avail < qty:
                            raise HTTPException(
                                status_code=409,
                                detail=f"Bundle '{bundle.get('name')}' needs {qty} units of '{svc['name']}' but only {avail} are in stock.",
                            )
                        item_holds_to_create.append({
                            "entity_id": svc["linked_inventory_id"],
                            "operator_id": svc.get("operator_id"),
                            "quantity": qty,
                            "item_name": svc.get("name"),
                            "unit_price": float(svc.get("base_price") or 0),
                        })

            line_items_out.append({
                "source": "package",
                "package_id": bundle["_id"],
                "service_name": bundle.get("name"),
                "category": "package",
                "discount_percent": bundle.get("discount_percent", 0),
                "subtotal": bundle.get("subtotal", 0),
                "line_total": bundle_total,
                "operator_id": bundle.get("operator_id"),
                "operator_name": bundle.get("operator_name"),
                "services": inner_lines,
            })

    subtotal = round(subtotal, 2)
    # Optional client-supplied service fee / promo discount. Default to 0
    # when omitted so legacy callers (no fee/promo) still see total_price
    # == subtotal — the new BanquetCheckout sends these explicitly.
    service_fee = float(payload.service_fee) if payload.service_fee is not None else 0.0
    promo_discount = float(payload.promo_discount or 0)
    grand_total = round(max(0.0, subtotal + service_fee - promo_discount), 2)

    # 4. Mint identifiers + order number.
    order_id = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())
    order_count = await db.orders.count_documents({"service_category": "banquet"})
    order_number = f"EVT-{order_count + 1:06d}"

    primary_operator_id = next(
        (li.get("operator_id") for li in line_items_out if li.get("operator_id")), None
    )
    primary_operator_name = next(
        (li.get("operator_name") for li in line_items_out if li.get("operator_name")), ""
    )

    booking_doc = {
        "_id": booking_id,
        "order_id": order_id,
        "user_id": current_user["_id"],
        "event_date": payload.event_date,
        "event_time": payload.event_time,
        "event_type": payload.event_type,
        "expected_guests": payload.expected_guests,
        "contact_name": payload.contact_name,
        "contact_phone": payload.contact_phone,
        "contact_email": payload.contact_email,
        "address": payload.address,
        "special_requests": payload.special_requests,
        "line_items": line_items_out,
        "subtotal": subtotal,
        "service_fee": service_fee,
        "promo_code": payload.promo_code,
        "promo_discount": promo_discount,
        "total_price": grand_total,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.banquet_bookings.insert_one(booking_doc)

    order_doc = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "banquet",
        "service_booking_id": booking_id,
        "service_name": f"Event @ {payload.event_date}" + (
            f" ({len(line_items_out)} items)" if line_items_out else ""
        ),
        "service_id": booking_id,   # for back-compat reporting
        "user_id": current_user["_id"],
        "operator_id": primary_operator_id,
        "operator_name": primary_operator_name,
        "total_amount": grand_total,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "event_date": payload.event_date,
            "event_time": payload.event_time,
            "event_type": payload.event_type,
            "expected_guests": payload.expected_guests,
            "contact_name": payload.contact_name,
            "contact_phone": payload.contact_phone,
            "contact_email": payload.contact_email,
            "address": payload.address,
            "special_requests": payload.special_requests,
            "subtotal": subtotal,
            "service_fee": service_fee,
            "promo_code": payload.promo_code,
            "promo_discount": promo_discount,
            "line_items": line_items_out,
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.orders.insert_one(order_doc)

    # Create inventory holds for each rentable banquet_item line. The hold
    # decrements `available_units` and surfaces to the operator dashboard.
    hold_ids: list[str] = []
    for h in item_holds_to_create:
        hold_doc = {
            "_id": str(uuid.uuid4()),
            "entity_type": "banquet_item",
            "entity_id": h["entity_id"],
            "operator_id": h["operator_id"],
            "booking_id": order_id,
            "customer_id": current_user["_id"],
            "customer_name": payload.contact_name,
            "unit_ids": [],
            "quantity": h["quantity"],
            "start_date": payload.event_date,
            "end_date": payload.event_date,
            "status": "reserved",
            "damaged_quantity": 0,
            "damage_fee": 0.0,
            "damage_description": None,
            "operator_note": None,
            "item_name": h["item_name"],
            "unit_price": h["unit_price"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await db.inventory_holds.insert_one(hold_doc)
        hold_ids.append(hold_doc["_id"])
        # Refresh available_units on the item.
        from routes.inventory import _refresh_available  # local import to avoid cycle
        await _refresh_available(db, "banquet_item", h["entity_id"])

    return {
        "message": "Event order created",
        "order_id": order_id,
        "order_number": order_number,
        "booking_id": booking_id,
        "subtotal": subtotal,
        "service_fee": service_fee,
        "promo_discount": promo_discount,
        "total_price": grand_total,
        "currency": "XAF",
        "line_items": line_items_out,
        "inventory_hold_ids": hold_ids,
    }
