from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.banquet import BanquetCreate, BanquetUpdate, BanquetStatus
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/banquets", tags=["Banquets"])

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
    capacity_min: Optional[int] = None,
    capacity_max: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get banquet venues - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"status": BanquetStatus.ACTIVE}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if venue_type:
        query["venue_type"] = venue_type
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
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get banquet venues for the current user's operator (operator-scoped).
    Super admin and admin can see all venues.
    Operator users can only see venues belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    
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

