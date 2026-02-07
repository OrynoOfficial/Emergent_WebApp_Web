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
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    from_city: Optional[str] = None
    to_city: Optional[str] = None
    base_fare: Optional[float] = None
    price: Optional[float] = None
    departure_time: str
    arrival_time: str
    duration_minutes: Optional[int] = None
    duration: Optional[str] = None
    total_seats: Optional[int] = 50
    vehicle_type: Optional[str] = "bus"
    vehicle_id: Optional[str] = None
    amenities: Optional[list] = []

@router.post("/routes")
async def create_travel_route(
    route_data: TravelRouteCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new travel route - operators can create routes for their organization"""
    db = get_database()
    
    # For operators, use their operator_id. For admins, allow specifying or use their ID
    operator_id = current_user.get("operator_id") or current_user["_id"]
    
    # Get operator name if available
    operator_name = current_user.get("operator_name", "")
    if not operator_name and current_user.get("operator_id"):
        operator = await db.operators.find_one({"_id": current_user["operator_id"]})
        if operator:
            operator_name = operator.get("name", "")
    
    # Build route data with field normalization
    route_dict = route_data.dict(exclude_none=True)
    
    # Normalize field names (support both old and new format)
    from_city = route_dict.get("from_city") or route_dict.get("origin", "")
    to_city = route_dict.get("to_city") or route_dict.get("destination", "")
    price = route_dict.get("price") or route_dict.get("base_fare", 0)
    total_seats = route_dict.get("total_seats", 50)
    
    route = {
        "_id": str(uuid.uuid4()),
        "from_city": from_city,
        "to_city": to_city,
        "origin": from_city,
        "destination": to_city,
        "route_name": route_dict.get("route_name") or f"{from_city} - {to_city}",
        "departure_time": route_dict.get("departure_time"),
        "arrival_time": route_dict.get("arrival_time"),
        "duration": route_dict.get("duration", ""),
        "duration_minutes": route_dict.get("duration_minutes", 0),
        "price": price,
        "base_fare": price,
        "total_seats": total_seats,
        "available_seats": total_seats,
        "vehicle_type": route_dict.get("vehicle_type", "bus"),
        "vehicle_id": route_dict.get("vehicle_id"),
        "amenities": route_dict.get("amenities", []),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "created_by": current_user["_id"],
        "is_active": True,
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.travel_routes.insert_one(route)
    return {"message": "Route created", "route_id": route["_id"]}

@router.get("/routes/management")
async def get_travel_routes_management(
    current_user: dict = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """Get travel routes for management - filtered by operator for operator users"""
    db = get_database()
    
    # Build query based on user role
    query = {}
    
    # Operators can only see routes they created or are assigned to
    if current_user["role"] == "operator":
        operator_id = current_user.get("operator_id")
        if operator_id:
            query["$or"] = [
                {"operator_id": operator_id},
                {"created_by": current_user["_id"]}
            ]
        else:
            # If no operator_id, only show routes they created
            query["created_by"] = current_user["_id"]
    
    routes = await db.travel_routes.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    # Enrich routes with vehicle info
    for route in routes:
        route["id"] = str(route.pop("_id", route.get("id", "")))
        # Get vehicle info if vehicle_id exists
        if route.get("vehicle_id"):
            vehicle = await db.vehicles.find_one({"_id": route["vehicle_id"]})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])
                route["vehicle_name"] = vehicle.get("vehicle_name", vehicle.get("name", ""))
    
    return {
        "routes": routes, 
        "total": total,
        "is_operator_scoped": current_user["role"] == "operator"
    }


@router.get("/routes")
async def get_travel_routes(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    from_city: Optional[str] = None,
    to_city: Optional[str] = None,
    country: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get travel routes with vehicle images - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"is_active": True}
    # Support both origin/destination and from_city/to_city parameters
    search_origin = origin or from_city
    search_destination = destination or to_city
    
    if search_origin:
        query["$or"] = [
            {"origin": {"$regex": search_origin, "$options": "i"}},
            {"from_city": {"$regex": search_origin, "$options": "i"}}
        ]
    if search_destination:
        dest_query = {"$or": [
            {"destination": {"$regex": search_destination, "$options": "i"}},
            {"to_city": {"$regex": search_destination, "$options": "i"}}
        ]}
        if "$or" in query:
            query = {"$and": [query, dest_query]}
        else:
            query.update(dest_query)
    
    # Apply country filter via operator lookup (travel_routes has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        if op_filter:
            if "$and" in query:
                query["$and"].append(op_filter)
            else:
                query.update(op_filter)
    
    routes = await db.travel_routes.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    # Enrich routes with vehicle images
    for route in routes:
        route["id"] = str(route.pop("_id", route.get("id", "")))
        vehicle_id = route.get("vehicle_id")
        if vehicle_id:
            vehicle = await db.vehicles.find_one({"_id": vehicle_id}, {"images": 1})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])
    
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
    
    # Transform _id to id and enrich with vehicle images
    for route in routes:
        route["id"] = str(route.pop("_id", ""))
        vehicle_id = route.get("vehicle_id")
        if vehicle_id:
            vehicle = await db.vehicles.find_one({"_id": vehicle_id}, {"images": 1})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])
    
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
    route_status: Optional[str] = None
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
    
    update_data = {}
    for k, v in route_data.dict().items():
        if v is not None:
            # Map route_status back to status in DB
            if k == "route_status":
                update_data["status"] = v
            else:
                update_data[k] = v
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