from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/travel", tags=["Travel"])

class TravelRouteCreate(BaseModel):
    route_name: str
    origin: str
    destination: str
    base_fare: float
    departure_time: str
    arrival_time: str
    duration_minutes: int
    total_seats: int

@router.post("/routes")
async def create_travel_route(
    route_data: TravelRouteCreate,
    current_user: dict = Depends(require_permission("travel.create"))
):
    """Create a new travel route - requires travel.create permission"""
    db = get_database()
    
    route = {
        "_id": str(uuid.uuid4()),
        **route_data.dict(),
        "operator_id": current_user["_id"],
        "available_seats": route_data.total_seats,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.travel_routes.insert_one(route)
    return {"message": "Route created", "route_id": route["_id"]}

@router.get("/routes")
async def get_travel_routes(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get travel routes"""
    db = get_database()
    
    query = {"is_active": True}
    if origin:
        query["origin"] = {"$regex": origin, "$options": "i"}
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    
    routes = await db.travel_routes.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    return {"routes": routes, "total": total}

@router.get("/routes/{route_id}")
async def get_travel_route(route_id: str):
    """Get route details"""
    db = get_database()
    route = await db.travel_routes.find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route