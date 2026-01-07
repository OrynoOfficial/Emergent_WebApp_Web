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


@router.get("/management/my-routes")
async def get_my_travel_routes(
    search: Optional[str] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get travel routes for the current user's operator (operator-scoped).
    Super admin and admin can see all routes.
    Operator users can only see routes belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"route_name": {"$regex": search, "$options": "i"}},
            {"origin": {"$regex": search, "$options": "i"}},
            {"destination": {"$regex": search, "$options": "i"}}
        ]
    if origin:
        query["origin"] = {"$regex": origin, "$options": "i"}
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    
    routes = await db.travel_routes.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    # Transform _id to id
    for route in routes:
        route["id"] = str(route.pop("_id", ""))
    
    return {
        "routes": routes, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }


class TravelRouteUpdate(BaseModel):
    from_city: Optional[str] = None
    to_city: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration: Optional[str] = None
    price: Optional[float] = None
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    total_seats: Optional[int] = None
    amenities: Optional[list] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    status: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


@router.put("/routes/{route_id}")
async def update_travel_route(
    route_id: str,
    route_data: TravelRouteUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a travel route"""
    db = get_database()
    
    route = await db.travel_routes.find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check authorization
    if current_user["role"] == "operator" and route.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized to update this route")
    
    update_data = {k: v for k, v in route_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.travel_routes.update_one({"_id": route_id}, {"$set": update_data})
    
    return {"message": "Route updated", "route_id": route_id}


@router.delete("/routes/{route_id}")
async def delete_travel_route(
    route_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a travel route"""
    db = get_database()
    
    route = await db.travel_routes.find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check authorization
    if current_user["role"] == "operator" and route.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this route")
    
    await db.travel_routes.delete_one({"_id": route_id})
    
    return {"message": "Route deleted", "route_id": route_id}


@router.post("/routes/{route_id}/approve")
async def approve_travel_route(
    route_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Approve a pending travel route"""
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can approve routes")
    
    db = get_database()
    
    route = await db.travel_routes.find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    await db.travel_routes.update_one(
        {"_id": route_id}, 
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Route approved", "route_id": route_id}