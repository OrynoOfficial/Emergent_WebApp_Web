from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.seat_booking import SeatReservationRequest, SeatBookingConfirm, SeatStatus
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/seat-bookings", tags=["Seat Bookings"])

RESERVATION_TIMEOUT_MINUTES = 3  # Seats are held for 3 minutes


async def _notify_seat_change(route_id: str, travel_date: str):
    """Broadcast seat change to all WebSocket clients."""
    try:
        from routes.seat_ws import broadcast_seat_change
        await broadcast_seat_change(route_id, travel_date)
    except Exception:
        pass  # Non-blocking – WS is best-effort

@router.get("/availability")
async def get_seat_availability(
    route_id: str,
    travel_date: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get seat availability for a route on a specific date"""
    db = get_database()
    
    # Get route details with seat layout - support both id and _id
    route = await db.travel_routes.find_one({"$or": [{"_id": route_id}, {"id": route_id}]})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Clean up expired reservations
    await db.seat_bookings.delete_many({
        "route_id": route_id,
        "travel_date": travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.utcnow()}
    })
    
    # Get all booked/reserved seats
    booked_seats = await db.seat_bookings.find(
        {
            "route_id": route_id,
            "travel_date": travel_date,
            "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}
        },
        {"_id": 0, "seat_number": 1, "status": 1, "user_id": 1}
    ).to_list(1000)
    
    booked_seat_numbers = {s["seat_number"]: s["status"] for s in booked_seats}
    
    return {
        "route_id": route_id,
        "travel_date": travel_date,
        "seat_layout": route.get("seat_layout"),
        "total_seats": route.get("total_seats", 45),
        "booked_seats": booked_seat_numbers,
        "available_count": route.get("total_seats", 45) - len(booked_seats),
        "route_details": {
            "departure_city": route.get("departure_city"),
            "arrival_city": route.get("arrival_city"),
            "departure_time": route.get("departure_time"),
            "price": route.get("price")
        }
    }

@router.post("/reserve")
async def reserve_seats(
    reservation: SeatReservationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Temporarily reserve seats (10 minute hold)"""
    db = get_database()
    
    # Check route exists - support both id and _id
    route = await db.travel_routes.find_one({"$or": [{"_id": reservation.route_id}, {"id": reservation.route_id}]})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Clean up expired reservations first
    await db.seat_bookings.delete_many({
        "route_id": reservation.route_id,
        "travel_date": reservation.travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.utcnow()}
    })
    
    # Check if any seats are already taken
    existing = await db.seat_bookings.find(
        {
            "route_id": reservation.route_id,
            "travel_date": reservation.travel_date,
            "seat_number": {"$in": reservation.seat_numbers},
            "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}
        }
    ).to_list(100)
    
    if existing:
        taken_seats = [s["seat_number"] for s in existing]
        raise HTTPException(
            status_code=400,
            detail=f"Seats already taken: {', '.join(taken_seats)}"
        )
    
    # Validate total seat availability — prevent over-reservation
    total_seats = route.get("total_seats", 45)
    all_booked_count = await db.seat_bookings.count_documents({
        "route_id": reservation.route_id,
        "travel_date": reservation.travel_date,
        "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}
    })
    available_count = total_seats - all_booked_count
    requested_count = len(reservation.seat_numbers)
    
    if requested_count > available_count:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available_count} seat(s) available, but {requested_count} requested"
        )
    
    # Validate seat numbers are within range
    for seat_num in reservation.seat_numbers:
        seat_n = int(seat_num) if seat_num.isdigit() else 0
        if seat_n < 1 or seat_n > total_seats:
            raise HTTPException(
                status_code=400,
                detail=f"Seat {seat_num} is out of range (1-{total_seats})"
            )
    
    # Create reservations
    reservation_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    expiry = datetime.utcnow() + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)
    
    # Calculate total price
    price_per_seat = route.get("price", 0)
    total_price = price_per_seat * len(reservation.seat_numbers)
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "travel"})
    order_number = f"TRV-{order_count + 1:06d}"
    
    seat_bookings = []
    for seat_num in reservation.seat_numbers:
        seat_bookings.append({
            "_id": str(uuid.uuid4()),
            "reservation_id": reservation_id,
            "order_id": order_id,  # Link to central order
            "route_id": reservation.route_id,
            "vehicle_id": route.get("vehicle_id"),
            "travel_date": reservation.travel_date,
            "seat_number": seat_num,
            "status": SeatStatus.RESERVED,
            "payment_status": "pending",
            "user_id": current_user["_id"],
            "reserved_at": datetime.utcnow(),
            "reservation_expires": expiry,
            "price": price_per_seat,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    await db.seat_bookings.insert_many(seat_bookings)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "travel",
        "service_booking_id": reservation_id,
        "service_name": f"Travel - {route.get('origin', '')} to {route.get('destination', '')}",
        "service_id": reservation.route_id,
        "user_id": current_user["_id"],
        "operator_id": route.get("operator_id"),
        "operator_name": route.get("operator_name"),
        "total_amount": total_price,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "travel_date": reservation.travel_date,
            "seats": reservation.seat_numbers,
            "origin": route.get("origin"),
            "destination": route.get("destination"),
            "departure_time": route.get("departure_time")
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)

    # Broadcast real-time update to all connected WebSocket clients
    await _notify_seat_change(reservation.route_id, reservation.travel_date)
    
    return {
        "message": "Seats reserved",
        "reservation_id": reservation_id,
        "order_id": order_id,
        "order_number": order_number,
        "seats": reservation.seat_numbers,
        "total_price": total_price,
        "expires_at": expiry.isoformat(),
        "timeout_minutes": RESERVATION_TIMEOUT_MINUTES
    }

@router.post("/confirm")
async def confirm_booking(
    booking: SeatBookingConfirm,
    current_user: dict = Depends(get_current_active_user)
):
    """Confirm seat booking after payment"""
    db = get_database()
    
    # Update reservations to booked status
    for passenger in booking.passengers:
        await db.seat_bookings.update_one(
            {
                "route_id": booking.route_id,
                "travel_date": booking.travel_date,
                "seat_number": passenger["seat_number"],
                "user_id": current_user["_id"],
                "status": SeatStatus.RESERVED
            },
            {
                "$set": {
                    "status": SeatStatus.BOOKED,
                    "order_id": booking.order_id,
                    "passenger_name": passenger.get("name"),
                    "passenger_id_number": passenger.get("id_number"),
                    "passenger_phone": passenger.get("phone"),
                    "booked_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    await _notify_seat_change(booking.route_id, booking.travel_date)
    return {"message": "Booking confirmed", "order_id": booking.order_id}

@router.post("/release")
async def release_seats(
    route_id: str = Query(...),
    travel_date: str = Query(...),
    seat_numbers: List[str] = Query(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Release reserved seats (before payment)"""
    db = get_database()
    
    result = await db.seat_bookings.delete_many({
        "route_id": route_id,
        "travel_date": travel_date,
        "seat_number": {"$in": seat_numbers},
        "user_id": current_user["_id"],
        "status": SeatStatus.RESERVED
    })

    await _notify_seat_change(route_id, travel_date)
    return {"message": f"Released {result.deleted_count} seats"}

@router.get("/my-bookings")
async def get_my_bookings(
    booking_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's seat bookings"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if booking_status:
        query["status"] = booking_status
    
    bookings = await db.seat_bookings.find(query, {"_id": 0}).sort("travel_date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.seat_bookings.count_documents(query)
    
    return {"bookings": bookings, "total": total}


@router.get("/available-counts")
async def get_available_seat_counts(
    route_ids: str = Query(..., description="Comma-separated route IDs"),
    travel_date: str = Query(..., description="Travel date YYYY-MM-DD")
):
    """Get available seat counts for multiple routes on a date. Public endpoint for search results."""
    db = get_database()
    
    ids = [rid.strip() for rid in route_ids.split(",") if rid.strip()]
    
    # Clean up expired reservations
    await db.seat_bookings.delete_many({
        "travel_date": travel_date,
        "status": SeatStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.utcnow()}
    })
    
    # Aggregate booked+reserved counts per route
    pipeline = [
        {"$match": {
            "route_id": {"$in": ids},
            "travel_date": travel_date,
            "status": {"$in": [SeatStatus.RESERVED, SeatStatus.BOOKED]}
        }},
        {"$group": {"_id": "$route_id", "taken": {"$sum": 1}}}
    ]
    taken_counts = {doc["_id"]: doc["taken"] for doc in await db.seat_bookings.aggregate(pipeline).to_list(100)}
    
    # Get total seats per route
    routes = await db.travel_routes.find(
        {"$or": [{"_id": {"$in": ids}}, {"id": {"$in": ids}}]},
        {"_id": 1, "id": 1, "total_seats": 1}
    ).to_list(100)
    
    result = {}
    for r in routes:
        rid = str(r.get("_id") or r.get("id"))
        total = r.get("total_seats", 45)
        taken = taken_counts.get(rid, 0)
        result[rid] = {"total": total, "taken": taken, "available": max(0, total - taken)}
    
    return {"counts": result, "travel_date": travel_date}


@router.post("/release-beacon")
async def release_seats_beacon(
    data: dict
):
    """Release reserved seats via beacon (for page unload)"""
    db = get_database()
    
    # Verify token
    token = data.get("token")
    if not token:
        return {"message": "No token provided"}
    
    try:
        # Decode token to get user_id
        import jwt
        import os
        
        payload = jwt.decode(token, os.environ.get("JWT_SECRET", "your-secret-key"), algorithms=["HS256"])
        user_id = payload.get("user_id") or payload.get("sub")
        
        if not user_id:
            return {"message": "Invalid token"}
        
        route_id = data.get("route_id")
        travel_date = data.get("travel_date")
        seat_numbers = data.get("seat_numbers", [])
        
        if not route_id or not travel_date or not seat_numbers:
            return {"message": "Missing required fields"}
        
        result = await db.seat_bookings.delete_many({
            "route_id": route_id,
            "travel_date": travel_date,
            "seat_number": {"$in": seat_numbers},
            "user_id": user_id,
            "status": SeatStatus.RESERVED
        })
        
        return {"message": f"Released {result.deleted_count} seats"}
        
    except jwt.ExpiredSignatureError:
        return {"message": "Token expired"}
    except jwt.InvalidTokenError:
        return {"message": "Invalid token"}
    except Exception as e:
        return {"message": str(e)}

