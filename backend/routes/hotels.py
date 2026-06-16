from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, check_user_permission
from typing import Optional, List
from datetime import datetime, timedelta
from collections import defaultdict
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/hotels", tags=["Hotels"])

class HotelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: str
    city: str
    country: str
    star_rating: Optional[int] = None
    amenities: list = []
    images: list = []  # Support for multiple hotel images (5-10)
    phone: Optional[str] = None
    email: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    policies: List[str] = []
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None

@router.post("/")
async def create_hotel(
    hotel_data: HotelCreate,
    current_user: dict = Depends(require_permission("hotels.create"))
):
    """Create a new hotel - requires hotels.create permission"""
    db = get_database()
    
    # Use provided operator_id or default to current user
    operator_id = hotel_data.operator_id or current_user["_id"]
    operator_name = hotel_data.operator_name or ""
    
    # If operator_id provided but no name, try to fetch it
    if operator_id and not operator_name:
        operator = await db.operators.find_one({"_id": operator_id})
        if operator:
            operator_name = operator.get("name", "")
    
    hotel = {
        "_id": str(uuid.uuid4()),
        **hotel_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "average_rating": 0.0,
        "total_ratings": 0,
        "total_rooms": 0,
        "available_rooms": 0,
        "status": "pending",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.hotels.insert_one(hotel)
    return {"message": "Hotel created", "hotel_id": hotel["_id"]}

@router.get("/")
async def get_hotels(
    city: Optional[str] = None,
    country: Optional[str] = None,
    min_rating: Optional[float] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get all hotels with filters - public endpoint"""
    db = get_database()
    
    query = {"is_active": True}
    if operator_id:
        query["operator_id"] = operator_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if country:
        from utils.location_filter import get_country_filter, get_operator_ids_for_country
        from utils.geolocation import is_african_country
        if is_african_country(country):
            direct = await get_country_filter(db, country)
            op_ids = await get_operator_ids_for_country(db, country)
            conditions = []
            if direct:
                conditions.append(direct)
            if op_ids:
                conditions.append({"operator_id": {"$in": op_ids}})
            if conditions:
                query["$or"] = conditions
        # Non-African country: show all (global view) - no filter applied
    if min_rating:
        query["average_rating"] = {"$gte": min_rating}
    
    hotels = await db.hotels.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.hotels.count_documents(query)
    
    # Transform _id to id and add minimum room price + live available_rooms for each hotel
    for hotel in hotels:
        hotel["id"] = str(hotel.pop("_id", ""))
        
        # Get minimum room price AND aggregate live availability for this hotel
        rooms = await db.rooms.find(
            {"hotel_id": hotel["id"], "is_active": {"$ne": False}},
            {"base_price": 1, "price_per_night": 1, "available_rooms": 1, "total_rooms": 1}
        ).to_list(200)
        
        if rooms:
            min_price = min(r.get("base_price", 0) or r.get("price_per_night", 0) for r in rooms)
            hotel["price_per_night"] = min_price if min_price > 0 else hotel.get("base_price", 50000)
            # Aggregate available_rooms across all active room types -> drives AlmostSoldOutBadge
            hotel["available_rooms"] = sum(int(r.get("available_rooms") or 0) for r in rooms)
        else:
            # Fallback to a default price or hotel's stored price
            hotel["price_per_night"] = hotel.get("base_price", 50000)
            hotel["available_rooms"] = int(hotel.get("available_rooms") or 0)
    
    return {"hotels": hotels, "total": total}


@router.get("/management/my-hotels")
async def get_my_hotels(
    search: Optional[str] = None,
    city: Optional[str] = None,
    star_rating: Optional[int] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get hotels for the current user's operator (operator-scoped).
    Super admin and admin can see all hotels.
    Operator users can only see hotels belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter (operators are auto-scoped)
    query = get_operator_filter(current_user)
    # Hide soft-deleted hotels (DELETE flips is_active to False — they should
    # not appear in management lists unless explicitly requested via ?include_inactive=true).
    query["is_active"] = {"$ne": False}
    # Admin / super_admin override: allow filtering by a specific operator via query param
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
    if star_rating:
        query["star_rating"] = star_rating
    
    # Single aggregation pass: list page + room counts in one round-trip
    # (replaces the previous N+1 of "find hotels" + per-hotel count_documents).
    pipeline = [
        {"$match": query},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "rooms",
            "let": {"hid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$hotel_id", "$$hid"]}}},
                {"$count": "n"},
            ],
            "as": "_room_count",
        }},
        {"$addFields": {
            "room_count": {"$ifNull": [{"$arrayElemAt": ["$_room_count.n", 0]}, 0]},
        }},
        {"$project": {"_room_count": 0}},
    ]
    hotels = await db.hotels.aggregate(pipeline).to_list(limit)
    total = await db.hotels.count_documents(query)

    # Transform _id to id
    for hotel in hotels:
        hotel["id"] = str(hotel.pop("_id", ""))
    
    return {
        "hotels": hotels, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }


@router.get("/{hotel_id}")
async def get_hotel(hotel_id: str):
    """Get hotel details - public endpoint"""
    db = get_database()
    hotel = await db.hotels.find_one({"_id": hotel_id})
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel

@router.put("/{hotel_id}")
async def update_hotel(
    hotel_id: str,
    hotel_data: dict,
    current_user: dict = Depends(require_permission("hotels.edit"))
):
    """Update hotel - requires hotels.edit permission"""
    db = get_database()
    hotel = await db.hotels.find_one({"_id": hotel_id})
    
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # Check if user owns this hotel (operators can only edit their own)
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if hotel.get("operator_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own hotels")
    
    # If operator_id is being updated, fetch the operator name
    if "operator_id" in hotel_data and hotel_data["operator_id"]:
        if not hotel_data.get("operator_name"):
            operator = await db.operators.find_one({"_id": hotel_data["operator_id"]})
            if operator:
                hotel_data["operator_name"] = operator.get("name", "")
    
    # Operators cannot set status to active; data changes reset status to pending
    is_operator = user_role not in ["admin", "super_admin"]
    if is_operator:
        hotel_data.pop("status", None)  # prevent operator from setting status directly
        data_fields = {k for k in hotel_data if k not in ("updated_at",)}
        if data_fields:
            hotel_data["status"] = "pending"
    
    hotel_data["updated_at"] = datetime.utcnow()
    await db.hotels.update_one({"_id": hotel_id}, {"$set": hotel_data})
    return {"message": "Hotel updated"}


@router.delete("/{hotel_id}")
async def delete_hotel(
    hotel_id: str,
    hard: bool = False,
    current_user: dict = Depends(require_permission("hotels.delete"))
):
    """Delete hotel.

    - Default: soft-delete (sets `is_active: False`). Hotel disappears from
      listings but stays in the DB so historical bookings still resolve.
    - `?hard=true` (super-admin only): permanently remove the hotel **and**
      cascade-delete all its rooms. Use this to clean up test/junk records.
    """
    db = get_database()
    hotel = await db.hotels.find_one({"_id": hotel_id})

    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    # Check if user owns this hotel (operators can only delete their own)
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if hotel.get("operator_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own hotels")

    # Hard delete is gated to super-admins to avoid accidental data loss.
    if hard:
        if user_role != "super_admin":
            raise HTTPException(
                status_code=403,
                detail="Only super administrators may permanently delete a hotel.",
            )
        # Cascade rooms first so we don't leave orphaned inventory.
        rooms_deleted = await db.rooms.delete_many({"hotel_id": hotel_id})
        await db.hotels.delete_one({"_id": hotel_id})
        return {
            "message": "Hotel permanently deleted",
            "hard_delete": True,
            "rooms_deleted": rooms_deleted.deleted_count,
        }

    # Soft delete - just mark as inactive
    await db.hotels.update_one(
        {"_id": hotel_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )

    return {"message": "Hotel deleted", "hard_delete": False}

# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/dashboard")
async def get_hotel_dashboard_analytics(
    period: str = Query("30days", description="Time period: 7days, 30days, 3months, 6months"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get comprehensive hotel dashboard analytics"""
    db = get_database()
    
    # Period calculation
    periods = {"7days": 7, "30days": 30, "3months": 90, "6months": 180}
    days = periods.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)
    
    # Get hotels (filter by operator if not admin)
    hotel_query = {"is_active": True}
    if current_user.get("role") not in ["admin", "super_admin"]:
        hotel_query["operator_id"] = current_user["_id"]
    
    hotels = await db.hotels.find(hotel_query).to_list(1000)
    hotel_ids = [h["_id"] for h in hotels]
    
    # Get rooms for these hotels
    rooms = await db.rooms.find({"hotel_id": {"$in": hotel_ids}}).to_list(1000)
    
    # Get room bookings in period
    bookings = await db.room_bookings.find({
        "hotel_id": {"$in": hotel_ids},
        "created_at": {"$gte": start_date}
    }).to_list(10000)
    
    # Previous period bookings for comparison
    prev_bookings = await db.room_bookings.find({
        "hotel_id": {"$in": hotel_ids},
        "created_at": {"$gte": prev_start, "$lt": start_date}
    }).to_list(10000)
    
    # Calculate metrics
    total_hotels = len(hotels)
    total_rooms = len(rooms)
    total_bookings = len(bookings)
    prev_total_bookings = len(prev_bookings)
    
    # Revenue calculation
    total_revenue = sum(b.get("total_amount", 0) for b in bookings)
    prev_revenue = sum(b.get("total_amount", 0) for b in prev_bookings)
    
    # Growth rates
    bookings_growth = ((total_bookings - prev_total_bookings) / prev_total_bookings * 100) if prev_total_bookings > 0 else 0
    revenue_growth = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    
    # Occupancy calculation
    total_available = sum(r.get("total_rooms", 1) for r in rooms)
    total_occupied = sum(r.get("total_rooms", 1) - r.get("available_rooms", 0) for r in rooms)
    avg_occupancy = (total_occupied / total_available * 100) if total_available > 0 else 0
    
    # Average rating
    avg_rating = sum(h.get("average_rating", 0) or h.get("star_rating", 3) for h in hotels) / len(hotels) if hotels else 0
    
    # Bookings by status
    status_counts = defaultdict(int)
    for b in bookings:
        status_counts[b.get("status", "pending")] += 1
    
    # Daily booking trend
    daily_trend = defaultdict(lambda: {"bookings": 0, "revenue": 0, "checkins": 0})
    for b in bookings:
        date_key = b.get("created_at", datetime.utcnow()).strftime("%Y-%m-%d")
        daily_trend[date_key]["bookings"] += 1
        daily_trend[date_key]["revenue"] += b.get("total_amount", 0)
        if b.get("status") == "confirmed":
            daily_trend[date_key]["checkins"] += 1
    
    # Sort and limit to last 14 days
    daily_data = sorted([{"date": k, **v} for k, v in daily_trend.items()], key=lambda x: x["date"])[-14:]
    
    # Revenue by hotel
    hotel_revenue = defaultdict(lambda: {"revenue": 0, "bookings": 0})
    hotel_map = {h["_id"]: h.get("name", "Unknown") for h in hotels}
    for b in bookings:
        hotel_name = hotel_map.get(b.get("hotel_id"), "Unknown")
        hotel_revenue[hotel_name]["revenue"] += b.get("total_amount", 0)
        hotel_revenue[hotel_name]["bookings"] += 1
    
    top_hotels = sorted([{"name": k, **v} for k, v in hotel_revenue.items()], key=lambda x: x["revenue"], reverse=True)[:5]
    
    # Room type distribution
    room_types = defaultdict(int)
    for r in rooms:
        room_types[r.get("room_type", "standard")] += 1
    
    room_distribution = [{"type": k.title(), "count": v} for k, v in room_types.items()]
    
    # Star rating distribution
    star_distribution = defaultdict(int)
    for h in hotels:
        star_distribution[h.get("star_rating", 3)] += 1
    
    star_data = [{"stars": k, "count": v} for k, v in sorted(star_distribution.items())]
    
    # City distribution
    city_distribution = defaultdict(int)
    for h in hotels:
        city_distribution[h.get("city", "Unknown")] += 1
    
    city_data = [{"city": k, "count": v} for k, v in sorted(city_distribution.items(), key=lambda x: x[1], reverse=True)][:6]
    
    # Recent bookings
    recent_bookings = await db.room_bookings.find({
        "hotel_id": {"$in": hotel_ids}
    }).sort("created_at", -1).limit(10).to_list(10)
    
    for rb in recent_bookings:
        rb["id"] = str(rb.pop("_id", ""))
        rb["hotel_name"] = hotel_map.get(rb.get("hotel_id"), "Unknown")
    
    return {
        "summary": {
            "totalHotels": total_hotels,
            "totalRooms": total_rooms,
            "totalBookings": total_bookings,
            "totalRevenue": total_revenue,
            "avgOccupancy": round(avg_occupancy, 1),
            "avgRating": round(avg_rating, 1),
            "bookingsGrowth": round(bookings_growth, 1),
            "revenueGrowth": round(revenue_growth, 1)
        },
        "bookingsByStatus": dict(status_counts),
        "dailyTrend": daily_data,
        "topHotels": top_hotels,
        "roomDistribution": room_distribution,
        "starDistribution": star_data,
        "cityDistribution": city_data,
        "recentBookings": recent_bookings
    }


@router.get("/analytics/occupancy")
async def get_occupancy_analytics(
    hotel_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get occupancy analytics for hotels"""
    db = get_database()
    
    hotel_query = {"is_active": True}
    if hotel_id:
        hotel_query["_id"] = hotel_id
    elif current_user.get("role") not in ["admin", "super_admin"]:
        hotel_query["operator_id"] = current_user["_id"]
    
    hotels = await db.hotels.find(hotel_query).to_list(100)
    
    occupancy_data = []
    for hotel in hotels:
        rooms = await db.rooms.find({"hotel_id": hotel["_id"]}).to_list(100)
        total = sum(r.get("total_rooms", 1) for r in rooms)
        available = sum(r.get("available_rooms", 0) for r in rooms)
        occupied = total - available
        
        occupancy_data.append({
            "hotel_id": hotel["_id"],
            "hotel_name": hotel.get("name", "Unknown"),
            "city": hotel.get("city", "Unknown"),
            "total_rooms": total,
            "occupied_rooms": occupied,
            "available_rooms": available,
            "occupancy_rate": round((occupied / total * 100) if total > 0 else 0, 1)
        })
    
    # Weekly occupancy trend (simulated for now)
    weekly_trend = []
    for i in range(7):
        day = datetime.utcnow() - timedelta(days=6-i)
        weekly_trend.append({
            "day": day.strftime("%a"),
            "date": day.strftime("%Y-%m-%d"),
            "occupancy": 60 + (i * 5) + (10 if day.weekday() >= 5 else 0)  # Higher on weekends
        })
    
    return {
        "hotels": occupancy_data,
        "weeklyTrend": weekly_trend,
        "averageOccupancy": round(sum(h["occupancy_rate"] for h in occupancy_data) / len(occupancy_data), 1) if occupancy_data else 0
    }


# ==================== COMMUNICATIONS ENDPOINTS ====================

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    target_type: str = "all"  # all, guests, staff, operators
    priority: str = "normal"  # low, normal, high, urgent
    hotel_id: Optional[str] = None

class AlertCreate(BaseModel):
    title: str
    message: str
    alert_type: str = "info"  # info, warning, error, success
    hotel_id: Optional[str] = None

@router.post("/communications/announcements")
async def create_announcement(
    data: AnnouncementCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a hotel announcement"""
    db = get_database()
    
    announcement = {
        "_id": str(uuid.uuid4()),
        "title": data.title,
        "message": data.message,
        "target_type": data.target_type,
        "priority": data.priority,
        "hotel_id": data.hotel_id,
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", current_user.get("email", "Admin")),
        "status": "active",
        "read_by": [],
        "created_at": datetime.utcnow()
    }
    
    await db.hotel_announcements.insert_one(announcement)
    
    return {"message": "Announcement created", "announcement_id": announcement["_id"]}


@router.get("/communications/announcements")
async def get_announcements(
    hotel_id: Optional[str] = None,
    status: str = "active",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get hotel announcements"""
    db = get_database()
    
    query = {"status": status}
    if hotel_id:
        query["hotel_id"] = hotel_id
    
    announcements = await db.hotel_announcements.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for a in announcements:
        a["id"] = str(a.pop("_id", ""))
    
    return {"announcements": announcements}


@router.post("/communications/alerts")
async def create_alert(
    data: AlertCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a hotel alert"""
    db = get_database()
    
    alert = {
        "_id": str(uuid.uuid4()),
        "title": data.title,
        "message": data.message,
        "alert_type": data.alert_type,
        "hotel_id": data.hotel_id,
        "created_by": current_user["_id"],
        "is_resolved": False,
        "created_at": datetime.utcnow()
    }
    
    await db.hotel_alerts.insert_one(alert)
    
    return {"message": "Alert created", "alert_id": alert["_id"]}


@router.get("/communications/alerts")
async def get_alerts(
    hotel_id: Optional[str] = None,
    is_resolved: Optional[bool] = False,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get hotel alerts"""
    db = get_database()
    
    query = {}
    if hotel_id:
        query["hotel_id"] = hotel_id
    if is_resolved is not None:
        query["is_resolved"] = is_resolved
    
    alerts = await db.hotel_alerts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for a in alerts:
        a["id"] = str(a.pop("_id", ""))
    
    return {"alerts": alerts}


@router.put("/communications/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark alert as resolved"""
    db = get_database()
    
    result = await db.hotel_alerts.update_one(
        {"_id": alert_id},
        {"$set": {"is_resolved": True, "resolved_at": datetime.utcnow(), "resolved_by": current_user["_id"]}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved"}


@router.get("/communications/messages")
async def get_hotel_messages(
    hotel_id: Optional[str] = None,
    message_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get hotel messages and notifications"""
    db = get_database()
    
    # Combine announcements, alerts, and system messages
    messages = []
    
    # Get announcements
    ann_query = {"status": "active"}
    if hotel_id:
        ann_query["hotel_id"] = hotel_id
    announcements = await db.hotel_announcements.find(ann_query).sort("created_at", -1).limit(10).to_list(10)
    for a in announcements:
        messages.append({
            "id": str(a["_id"]),
            "type": "announcement",
            "title": a.get("title", "Announcement"),
            "message": a.get("message", ""),
            "priority": a.get("priority", "normal"),
            "created_at": a.get("created_at", datetime.utcnow()),
            "created_by": a.get("created_by_name", "System")
        })
    
    # Get alerts
    alert_query = {"is_resolved": False}
    if hotel_id:
        alert_query["hotel_id"] = hotel_id
    alerts = await db.hotel_alerts.find(alert_query).sort("created_at", -1).limit(10).to_list(10)
    for a in alerts:
        messages.append({
            "id": str(a["_id"]),
            "type": "alert",
            "title": a.get("title", "Alert"),
            "message": a.get("message", ""),
            "alert_type": a.get("alert_type", "info"),
            "created_at": a.get("created_at", datetime.utcnow()),
            "is_resolved": a.get("is_resolved", False)
        })
    
    # Get recent bookings as notifications
    booking_query = {}
    if hotel_id:
        booking_query["hotel_id"] = hotel_id
    recent_bookings = await db.room_bookings.find(booking_query).sort("created_at", -1).limit(5).to_list(5)
    for b in recent_bookings:
        messages.append({
            "id": str(b["_id"]),
            "type": "booking",
            "title": f"New Booking - {b.get('guest_name', 'Guest')}",
            "message": f"Room booking for {b.get('check_in_date', 'N/A')} - {b.get('check_out_date', 'N/A')}",
            "status": b.get("status", "pending"),
            "created_at": b.get("created_at", datetime.utcnow())
        })
    
    # Sort by date
    messages.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    
    return {"messages": messages[:limit], "total": len(messages)}


# ==================== QUICK ACTION ENDPOINTS ====================

class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    priority: str = "normal"  # low, normal, high, urgent
    category: str = "general"  # general, technical, billing, feedback

class MeetingScheduleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    attendees: List[str] = []
    meeting_type: str = "internal"  # internal, external, support

@router.post("/communications/support-ticket")
async def create_support_ticket(
    data: SupportTicketCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a support ticket"""
    db = get_database()
    
    ticket = {
        "_id": str(uuid.uuid4()),
        "subject": data.subject,
        "message": data.message,
        "priority": data.priority,
        "category": data.category,
        "status": "open",
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", current_user.get("email", "User")),
        "created_by_email": current_user.get("email", ""),
        "responses": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.hotel_support_tickets.insert_one(ticket)
    
    # Also create a notification for this
    notification = {
        "_id": str(uuid.uuid4()),
        "type": "support_ticket",
        "title": f"Support Ticket: {data.subject}",
        "message": data.message[:100] + "..." if len(data.message) > 100 else data.message,
        "user_id": current_user["_id"],
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Support ticket created", "ticket_id": ticket["_id"]}


@router.get("/communications/support-tickets")
async def get_support_tickets(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get support tickets"""
    db = get_database()
    
    query = {}
    if current_user.get("role") not in ["admin", "super_admin"]:
        query["created_by"] = current_user["_id"]
    if status:
        query["status"] = status
    
    tickets = await db.hotel_support_tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for t in tickets:
        t["id"] = str(t.pop("_id", ""))
    
    return {"tickets": tickets}


@router.post("/communications/schedule-meeting")
async def schedule_meeting(
    data: MeetingScheduleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Schedule a meeting"""
    db = get_database()
    
    meeting = {
        "_id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "attendees": data.attendees,
        "meeting_type": data.meeting_type,
        "status": "scheduled",
        "organizer_id": current_user["_id"],
        "organizer_name": current_user.get("full_name", current_user.get("email", "User")),
        "created_at": datetime.utcnow()
    }
    
    await db.hotel_meetings.insert_one(meeting)
    
    # Create notification
    notification = {
        "_id": str(uuid.uuid4()),
        "type": "meeting",
        "title": f"Meeting Scheduled: {data.title}",
        "message": f"Scheduled for {data.scheduled_date} at {data.scheduled_time}",
        "user_id": current_user["_id"],
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Meeting scheduled", "meeting_id": meeting["_id"]}


@router.get("/communications/meetings")
async def get_meetings(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get scheduled meetings"""
    db = get_database()
    
    query = {"organizer_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    meetings = await db.hotel_meetings.find(query).sort("scheduled_date", -1).skip(skip).limit(limit).to_list(limit)
    
    for m in meetings:
        m["id"] = str(m.pop("_id", ""))
    
    return {"meetings": meetings}


@router.get("/communications/notifications")
async def get_hotel_notifications(
    is_read: Optional[bool] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get real notifications for the user"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if is_read is not None:
        query["is_read"] = is_read
    
    notifications = await db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for n in notifications:
        n["id"] = str(n.pop("_id", ""))
    
    # Also get system-wide announcements
    announcements = await db.hotel_announcements.find({"status": "active"}).sort("created_at", -1).limit(5).to_list(5)
    for a in announcements:
        a["id"] = str(a.pop("_id", ""))
        a["type"] = "announcement"
    
    # Combine and sort
    all_notifications = notifications + announcements
    all_notifications.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    
    return {"notifications": all_notifications[:limit], "unread_count": len([n for n in notifications if not n.get("is_read", True)])}


@router.put("/communications/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark a notification as read"""
    db = get_database()
    
    await db.notifications.update_one(
        {"_id": notification_id, "user_id": current_user["_id"]},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    
    return {"message": "Notification marked as read"}
