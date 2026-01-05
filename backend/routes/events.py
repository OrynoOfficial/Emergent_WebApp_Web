from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/events", tags=["Events"])

class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: str
    venue: str
    city: str
    country: str
    event_date: datetime
    start_time: str
    end_time: str
    ticket_price: float
    total_seats: int
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    images: Optional[list] = []

@router.post("/")
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(require_permission("events.create"))
):
    """Create a new event - requires events.create permission"""
    db = get_database()
    
    # Use provided operator_id or default to current user
    operator_id = event_data.operator_id or current_user["_id"]
    operator_name = event_data.operator_name or ""
    
    # If operator_id provided but no name, try to fetch it
    if operator_id and not operator_name:
        operator = await db.operators.find_one({"_id": operator_id})
        if operator:
            operator_name = operator.get("name", "")
    
    event = {
        "_id": str(uuid.uuid4()),
        **event_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "available_seats": event_data.total_seats,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.events.insert_one(event)
    return {"message": "Event created", "event_id": event["_id"]}

@router.get("/")
async def get_events(
    city: Optional[str] = None,
    event_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get events"""
    db = get_database()
    
    query = {"is_active": True}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if event_type:
        query["event_type"] = event_type
    
    events = await db.events.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.events.count_documents(query)
    
    return {"events": events, "total": total}

@router.get("/{event_id}")
async def get_event(event_id: str):
    """Get event details"""
    db = get_database()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


class EventBookingCreate(BaseModel):
    event_id: str
    event_name: str
    ticket_type: str
    quantity: int
    contact_name: str
    contact_email: str
    contact_phone: str
    unit_price: float
    subtotal: float
    commission: float = 0
    total_amount: float


@router.post("/{event_id}/book")
async def create_event_booking(
    event_id: str,
    booking_data: EventBookingCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create an event booking"""
    db = get_database()
    
    # Check event exists
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check seats available
    if event.get("available_seats", 0) < booking_data.quantity:
        raise HTTPException(status_code=400, detail="Not enough seats available")
    
    # Generate booking number
    booking_count = await db.orders.count_documents({"service_category": "event"})
    booking_number = f"EVT-{booking_count + 1:06d}"
    
    booking = {
        "_id": str(uuid.uuid4()),
        "booking_number": booking_number,
        "user_id": current_user["_id"],
        "service_category": "event",
        "service_name": f"Event - {booking_data.event_name}",
        "event_id": event_id,
        "event_name": booking_data.event_name,
        "ticket_type": booking_data.ticket_type,
        "quantity": booking_data.quantity,
        "contact_name": booking_data.contact_name,
        "contact_email": booking_data.contact_email,
        "contact_phone": booking_data.contact_phone,
        "unit_price": booking_data.unit_price,
        "subtotal": booking_data.subtotal,
        "commission": booking_data.commission,
        "total_amount": booking_data.total_amount,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(booking)
    
    # Update available seats
    await db.events.update_one(
        {"_id": event_id},
        {"$inc": {"available_seats": -booking_data.quantity}}
    )
    
    return {
        "success": True,
        "message": "Event tickets booked successfully",
        "booking_id": booking["_id"],
        "booking_number": booking_number
    }


@router.get("/bookings/my")
async def get_my_event_bookings(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's event bookings"""
    db = get_database()
    
    bookings = await db.orders.find(
        {"user_id": current_user["_id"], "service_category": "event"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.orders.count_documents(
        {"user_id": current_user["_id"], "service_category": "event"}
    )
    
    return {"bookings": bookings, "total": total}