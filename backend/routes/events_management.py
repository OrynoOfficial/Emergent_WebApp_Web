from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.event import EventCreate, EventUpdate, EventStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/events", tags=["Events"])

@router.post("/")
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new event"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    operator_id = event_data.operator_id or current_user.get("operator_id")
    operator_name = event_data.operator_name or current_user.get("operator_name", "")
    
    # Calculate total capacity from ticket types
    total_capacity = event_data.total_capacity
    if event_data.ticket_types:
        total_capacity = sum(t.get("quantity", 0) for t in event_data.ticket_types)
    
    event = {
        "_id": str(uuid.uuid4()),
        **event_data.dict(exclude={"operator_id", "operator_name", "total_capacity"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "total_capacity": total_capacity,
        "tickets_sold": 0,
        "status": EventStatus.DRAFT,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.events.insert_one(event)
    
    return {"message": "Event created", "event_id": event["_id"]}

@router.get("/")
async def get_events(
    event_type: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    featured: Optional[bool] = None,
    operator_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get events with filters"""
    db = get_database()
    
    query = {}
    
    if event_type:
        query["event_type"] = event_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if status:
        query["status"] = status
    else:
        # By default, only show published events
        query["status"] = EventStatus.PUBLISHED
    if featured is not None:
        query["featured"] = featured
    if operator_id:
        query["operator_id"] = operator_id
    if start_date:
        query["start_date"] = {"$gte": start_date}
    if end_date:
        query["end_date"] = {"$lte": end_date}
    
    events = await db.events.find(query).sort("start_date", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.events.count_documents(query)
    
    # Transform _id to id for each event
    for event in events:
        event["id"] = str(event.pop("_id", ""))
    
    return {"events": events, "total": total}

@router.get("/{event_id}")
async def get_event(event_id: str):
    """Get event details"""
    db = get_database()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event["id"] = event.pop("_id")
    return event

@router.put("/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an event"""
    db = get_database()
    
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization
    if current_user["role"] == "operator" and event["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in event_data.dict().items() if v is not None}
    
    # Recalculate capacity if ticket types updated
    if "ticket_types" in update_data:
        update_data["total_capacity"] = sum(t.get("quantity", 0) for t in update_data["ticket_types"])
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.events.update_one({"_id": event_id}, {"$set": update_data})
    
    return {"message": "Event updated"}

@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete an event"""
    db = get_database()
    
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization
    if current_user["role"] == "operator" and event["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check for sold tickets
    if event.get("tickets_sold", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete event with sold tickets")
    
    await db.events.delete_one({"_id": event_id})
    
    return {"message": "Event deleted"}

@router.post("/{event_id}/publish")
async def publish_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Publish an event"""
    db = get_database()
    
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization
    if current_user["role"] == "operator" and event["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.events.update_one(
        {"_id": event_id},
        {"$set": {"status": EventStatus.PUBLISHED, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Event published"}

@router.post("/{event_id}/book")
async def book_event_tickets(
    event_id: str,
    ticket_type: str,
    quantity: int,
    attendee_info: List[dict],
    current_user: dict = Depends(get_current_active_user)
):
    """Book event tickets"""
    db = get_database()
    
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["status"] != EventStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Event not available for booking")
    
    # Find ticket type and check availability
    ticket_info = None
    for t in event.get("ticket_types", []):
        if t["name"] == ticket_type:
            ticket_info = t
            break
    
    if not ticket_info:
        raise HTTPException(status_code=404, detail="Ticket type not found")
    
    sold = ticket_info.get("sold", 0)
    available = ticket_info.get("quantity", 0) - sold
    
    if quantity > available:
        raise HTTPException(status_code=400, detail=f"Only {available} tickets available")
    
    total_price = ticket_info["price"] * quantity
    
    # Create booking
    booking = {
        "_id": str(uuid.uuid4()),
        "event_id": event_id,
        "user_id": current_user["_id"],
        "ticket_type": ticket_type,
        "quantity": quantity,
        "unit_price": ticket_info["price"],
        "total_price": total_price,
        "attendees": attendee_info,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await db.event_bookings.insert_one(booking)
    
    return {
        "message": "Tickets reserved",
        "booking_id": booking["_id"],
        "total_price": total_price,
        "quantity": quantity
    }

@router.get("/operator/events")
async def get_operator_events(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get operator's events"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    if status:
        query["status"] = status
    
    events = await db.events.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.events.count_documents(query)
    
    return {"events": events, "total": total}
