from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, check_user_permission
from typing import Optional
from datetime import datetime
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
    skip: int = 0,
    limit: int = 20
):
    """Get all hotels with filters - public endpoint"""
    db = get_database()
    
    query = {"is_active": True}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    if min_rating:
        query["average_rating"] = {"$gte": min_rating}
    
    hotels = await db.hotels.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.hotels.count_documents(query)
    
    # Transform _id to id and add minimum room price for each hotel
    for hotel in hotels:
        hotel["id"] = str(hotel.pop("_id", ""))
        
        # Get minimum room price for this hotel
        rooms = await db.rooms.find(
            {"hotel_id": hotel["id"], "is_active": {"$ne": False}},
            {"base_price": 1}
        ).to_list(100)
        
        if rooms:
            min_price = min(r.get("base_price", 0) or r.get("price_per_night", 0) for r in rooms)
            hotel["price_per_night"] = min_price if min_price > 0 else hotel.get("base_price", 50000)
        else:
            # Fallback to a default price or hotel's stored price
            hotel["price_per_night"] = hotel.get("base_price", 50000)
    
    return {"hotels": hotels, "total": total}

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
    
    hotel_data["updated_at"] = datetime.utcnow()
    await db.hotels.update_one({"_id": hotel_id}, {"$set": hotel_data})
    return {"message": "Hotel updated"}


@router.delete("/{hotel_id}")
async def delete_hotel(
    hotel_id: str,
    current_user: dict = Depends(require_permission("hotels.delete"))
):
    """Delete hotel - requires hotels.delete permission"""
    db = get_database()
    hotel = await db.hotels.find_one({"_id": hotel_id})
    
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # Check if user owns this hotel (operators can only delete their own)
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if hotel.get("operator_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own hotels")
    
    # Soft delete - just mark as inactive
    await db.hotels.update_one(
        {"_id": hotel_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Hotel deleted"}