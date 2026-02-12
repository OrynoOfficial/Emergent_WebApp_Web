from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.room import RoomCreate, RoomUpdate, RoomStatus
from models.room_booking import RoomReservationRequest, RoomBookingConfirm, RoomBookingStatus
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

RESERVATION_TIMEOUT_MINUTES = 15

# Room Management
@router.post("/")
async def create_room(
    room_data: RoomCreate,
    current_user: dict = Depends(require_permission("hotels.manage_rooms"))
):
    """Create a new room - requires hotels.manage_rooms permission"""
    db = get_database()
    
    # Verify hotel exists and user has access
    hotel = await db.hotels.find_one({"_id": room_data.hotel_id})
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if hotel.get("operator_id") != current_user.get("_id") and hotel.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized for this hotel")
    
    # Check room name doesn't already exist
    existing = await db.rooms.find_one({
        "hotel_id": room_data.hotel_id,
        "room_name": room_data.room_name
    })
    if existing:
        raise HTTPException(status_code=400, detail="Room name already exists")
    
    # Set available_rooms to total_rooms if not provided
    room_dict = room_data.dict()
    if room_dict.get("available_rooms") is None:
        room_dict["available_rooms"] = room_dict.get("total_rooms", 1)
    
    room = {
        "_id": str(uuid.uuid4()),
        **room_dict,
        "status": RoomStatus.AVAILABLE,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.rooms.insert_one(room)
    
    return {"message": "Room created", "room_id": room["_id"]}

@router.get("/")
async def get_rooms(
    hotel_id: str,
    room_type: Optional[str] = None,
    room_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get rooms for a hotel"""
    db = get_database()
    
    query = {"hotel_id": hotel_id}
    if room_type:
        query["room_type"] = room_type
    if room_status:
        query["status"] = room_status
    
    rooms = await db.rooms.find(query).sort("room_name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.rooms.count_documents(query)
    
    # Transform _id to id for each room
    for room in rooms:
        room["id"] = str(room.pop("_id", ""))
    
    return {"rooms": rooms, "total": total}

@router.get("/{room_id}")
async def get_room(room_id: str):
    """Get room details"""
    db = get_database()
    room = await db.rooms.find_one({"_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room["id"] = room_id
    return room

@router.put("/{room_id}")
async def update_room(
    room_id: str,
    room_data: RoomUpdate,
    current_user: dict = Depends(require_permission("hotels.manage_rooms"))
):
    """Update a room - requires hotels.manage_rooms permission"""
    db = get_database()
    
    room = await db.rooms.find_one({"_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check authorization via hotel
    hotel = await db.hotels.find_one({"_id": room["hotel_id"]})
    if current_user["role"] == "operator" and hotel.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in room_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.rooms.update_one({"_id": room_id}, {"$set": update_data})
    
    return {"message": "Room updated"}

@router.delete("/{room_id}")
async def delete_room(
    room_id: str,
    current_user: dict = Depends(require_permission("hotels.manage_rooms"))
):
    """Delete a room - requires hotels.manage_rooms permission"""
    db = get_database()
    
    room = await db.rooms.find_one({"_id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check for active bookings
    active_bookings = await db.room_bookings.count_documents({
        "room_id": room_id,
        "status": {"$in": [RoomBookingStatus.RESERVED, RoomBookingStatus.CONFIRMED]},
        "check_out_date": {"$gte": datetime.utcnow().strftime("%Y-%m-%d")}
    })
    
    if active_bookings > 0:
        raise HTTPException(status_code=400, detail="Cannot delete room with active bookings")
    
    await db.rooms.delete_one({"_id": room_id})
    
    return {"message": "Room deleted"}

# Room Availability
@router.get("/availability")
async def get_room_availability(
    hotel_id: str,
    check_in: str,
    check_out: str,
    room_type: Optional[str] = None,
    guests: int = 1
):
    """Get available rooms for date range"""
    db = get_database()
    
    # Clean up expired reservations
    await db.room_bookings.delete_many({
        "hotel_id": hotel_id,
        "status": RoomBookingStatus.RESERVED,
        "reservation_expires": {"$lt": datetime.utcnow()}
    })
    
    # Get all rooms
    query = {"hotel_id": hotel_id, "status": RoomStatus.AVAILABLE}
    if room_type:
        query["room_type"] = room_type
    if guests:
        query["capacity"] = {"$gte": guests}
    
    all_rooms = await db.rooms.find(query, {"_id": 0}).to_list(1000)
    
    # Get booked rooms for the date range
    booked = await db.room_bookings.find({
        "hotel_id": hotel_id,
        "status": {"$in": [RoomBookingStatus.RESERVED, RoomBookingStatus.CONFIRMED, RoomBookingStatus.CHECKED_IN]},
        "$or": [
            {"check_in_date": {"$lt": check_out}, "check_out_date": {"$gt": check_in}}
        ]
    }, {"room_id": 1}).to_list(1000)
    
    booked_room_ids = {b["room_id"] for b in booked}
    
    available_rooms = [r for r in all_rooms if r.get("id") not in booked_room_ids]
    
    return {
        "hotel_id": hotel_id,
        "check_in": check_in,
        "check_out": check_out,
        "available_rooms": available_rooms,
        "total_available": len(available_rooms)
    }

# Room Booking
@router.post("/bookings/reserve")
async def reserve_room(
    reservation: RoomReservationRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Reserve a room (temporary hold)"""
    db = get_database()
    
    # Check room is available
    room = await db.rooms.find_one({"_id": reservation.room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get hotel details
    hotel = await db.hotels.find_one({"_id": reservation.hotel_id})
    
    # Check no overlapping bookings
    existing = await db.room_bookings.find_one({
        "room_id": reservation.room_id,
        "status": {"$in": [RoomBookingStatus.RESERVED, RoomBookingStatus.CONFIRMED]},
        "$or": [
            {"check_in_date": {"$lt": reservation.check_out_date}, "check_out_date": {"$gt": reservation.check_in_date}}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Room not available for selected dates")
    
    # Calculate nights and price
    check_in = datetime.fromisoformat(reservation.check_in_date)
    check_out = datetime.fromisoformat(reservation.check_out_date)
    nights = (check_out - check_in).days
    total_price = room["base_price"] * nights
    
    room_booking_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "hotel"})
    order_number = f"HTL-{order_count + 1:06d}"
    
    # Create room booking
    booking = {
        "_id": room_booking_id,
        "order_id": order_id,  # Link to central order
        "hotel_id": reservation.hotel_id,
        "room_id": reservation.room_id,
        "room_name": room["room_name"],
        "user_id": current_user["_id"],
        "check_in_date": reservation.check_in_date,
        "check_out_date": reservation.check_out_date,
        "nights": nights,
        "guests": reservation.guests,
        "guest_name": reservation.guest_name,
        "guest_email": reservation.guest_email,
        "guest_phone": reservation.guest_phone,
        "special_requests": reservation.special_requests,
        "status": RoomBookingStatus.RESERVED,
        "payment_status": "pending",
        "base_price": room["base_price"],
        "total_price": total_price,
        "reserved_at": datetime.utcnow(),
        "reservation_expires": datetime.utcnow() + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.room_bookings.insert_one(booking)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "hotel",
        "service_booking_id": room_booking_id,
        "service_name": f"Hotel - {hotel.get('name', 'Room')} - {room.get('room_name', 'Room')}",
        "service_id": reservation.hotel_id,
        "user_id": current_user["_id"],
        "operator_id": hotel.get("operator_id") if hotel else None,
        "operator_name": hotel.get("operator_name") if hotel else None,
        "total_amount": total_price,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "check_in_date": reservation.check_in_date,
            "check_out_date": reservation.check_out_date,
            "nights": nights,
            "guests": reservation.guests,
            "guest_name": reservation.guest_name,
            "room_name": room.get("room_name", "")
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    return {
        "message": "Room reserved",
        "booking_id": room_booking_id,
        "order_id": order_id,
        "order_number": order_number,
        "total_price": total_price,
        "nights": nights,
        "expires_at": booking["reservation_expires"].isoformat()
    }

@router.post("/bookings/confirm")
async def confirm_room_booking(
    confirmation: RoomBookingConfirm,
    current_user: dict = Depends(get_current_active_user)
):
    """Confirm room booking after payment"""
    db = get_database()
    
    # Get the booking first to get room_id
    booking = await db.room_bookings.find_one({
        "_id": confirmation.booking_id,
        "user_id": current_user["_id"],
        "status": RoomBookingStatus.RESERVED
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or expired")
    
    result = await db.room_bookings.update_one(
        {"_id": confirmation.booking_id},
        {
            "$set": {
                "status": RoomBookingStatus.CONFIRMED,
                "order_id": confirmation.order_id,
                "confirmed_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Failed to confirm booking")
    
    # Decrease available_rooms count
    await db.rooms.update_one(
        {"_id": booking["room_id"]},
        {"$inc": {"available_rooms": -1}}
    )
    
    # Update room status if no rooms available
    room = await db.rooms.find_one({"_id": booking["room_id"]})
    if room and room.get("available_rooms", 0) <= 0:
        await db.rooms.update_one(
            {"_id": booking["room_id"]},
            {"$set": {"status": RoomStatus.BOOKED, "available_rooms": 0}}
        )
    
    return {"message": "Booking confirmed"}

@router.get("/bookings/my")
async def get_my_room_bookings(
    booking_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's room bookings"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if booking_status:
        query["status"] = booking_status
    
    bookings = await db.room_bookings.find(query, {"_id": 0}).sort("check_in_date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.room_bookings.count_documents(query)
    
    return {"bookings": bookings, "total": total}


@router.post("/bookings/{booking_id}/cancel")
async def cancel_room_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Cancel a room booking and restore availability"""
    db = get_database()
    
    booking = await db.room_bookings.find_one({
        "_id": booking_id,
        "user_id": current_user["_id"],
        "status": {"$in": [RoomBookingStatus.RESERVED, RoomBookingStatus.CONFIRMED]}
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update booking status
    await db.room_bookings.update_one(
        {"_id": booking_id},
        {
            "$set": {
                "status": RoomBookingStatus.CANCELLED,
                "cancelled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Restore available_rooms count if booking was confirmed
    if booking["status"] == RoomBookingStatus.CONFIRMED:
        await db.rooms.update_one(
            {"_id": booking["room_id"]},
            {"$inc": {"available_rooms": 1}}
        )
        
        # Update room status back to available if it was booked
        room = await db.rooms.find_one({"_id": booking["room_id"]})
        if room and room.get("status") == RoomStatus.BOOKED:
            await db.rooms.update_one(
                {"_id": booking["room_id"]},
                {"$set": {"status": RoomStatus.AVAILABLE}}
            )
    
    return {"message": "Booking cancelled"}


@router.post("/bookings/{booking_id}/checkout")
async def checkout_room_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Complete a room booking (checkout) and restore availability"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    booking = await db.room_bookings.find_one({
        "_id": booking_id,
        "status": RoomBookingStatus.CONFIRMED
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update booking status
    await db.room_bookings.update_one(
        {"_id": booking_id},
        {
            "$set": {
                "status": RoomBookingStatus.COMPLETED,
                "checked_out_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Restore available_rooms count
    await db.rooms.update_one(
        {"_id": booking["room_id"]},
        {"$inc": {"available_rooms": 1}}
    )
    
    # Update room status back to available if needed
    room = await db.rooms.find_one({"_id": booking["room_id"]})
    if room and room.get("status") == RoomStatus.BOOKED:
        await db.rooms.update_one(
            {"_id": booking["room_id"]},
            {"$set": {"status": RoomStatus.AVAILABLE}}
        )
    
    return {"message": "Checkout completed"}

