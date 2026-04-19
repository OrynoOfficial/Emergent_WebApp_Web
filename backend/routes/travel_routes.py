from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.travel_route import TravelRouteCreate, TravelRouteUpdate, RouteStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/travel", tags=["Travel"])

@router.post("/routes")
async def create_travel_route(
    route_data: TravelRouteCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new travel route"""
    db = get_database()
    
    # Check authorization
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Set operator info
    operator_id = route_data.operator_id or current_user.get("operator_id")
    operator_name = route_data.operator_name or current_user.get("operator_name", "")
    
    if not operator_id and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=400, detail="Operator ID required")
    
    # If vehicle is selected, get its details
    vehicle_info = {}
    if route_data.vehicle_id:
        vehicle = await db.vehicles.find_one({"_id": route_data.vehicle_id})
        if vehicle:
            vehicle_info = {
                "vehicle_name": vehicle.get("vehicle_name"),
                "vehicle_type": vehicle.get("vehicle_type"),
                "total_seats": vehicle.get("total_seats", 0),
                "seat_layout": vehicle.get("seat_layout"),
                "amenities": vehicle.get("amenities", [])
            }
    
    route = {
        "_id": str(uuid.uuid4()),
        **route_data.dict(exclude={"operator_id", "operator_name", "available_seats"}),
        **vehicle_info,  # Override with vehicle info if available
        "operator_id": operator_id,
        "operator_name": operator_name,
        "available_seats": route_data.available_seats or vehicle_info.get("total_seats", route_data.total_seats),
        "status": RouteStatus.PENDING,
        "active": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.travel_routes.insert_one(route)
    
    return {"message": "Route created", "route_id": route["_id"]}

@router.get("/routes")
async def get_travel_routes(
    from_city: Optional[str] = None,
    to_city: Optional[str] = None,
    operator_id: Optional[str] = None,
    status: Optional[str] = None,
    active: Optional[bool] = None,
    date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get travel routes with optional filters"""
    db = get_database()
    
    query = {}
    
    if from_city:
        query["from_city"] = {"$regex": from_city, "$options": "i"}
    if to_city:
        query["to_city"] = {"$regex": to_city, "$options": "i"}
    if operator_id:
        query["operator_id"] = operator_id
    if status:
        query["status"] = status
    if active is not None:
        query["active"] = active
    
    routes = await db.travel_routes.find(query).sort("departure_time", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    # Transform _id to id and enrich with vehicle info
    for route in routes:
        route["id"] = str(route.pop("_id", ""))
        vehicle_id = route.get("vehicle_id")
        if vehicle_id:
            vehicle = await db.vehicles.find_one({"_id": vehicle_id}, {"images": 1, "plate_number": 1, "vehicle_name": 1, "name": 1})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])[:2]
                route["plate_number"] = vehicle.get("plate_number", "")
                if not route.get("vehicle_name"):
                    route["vehicle_name"] = vehicle.get("vehicle_name", vehicle.get("name", ""))
    
    return {"routes": routes, "total": total, "skip": skip, "limit": limit}

@router.get("/routes/{route_id}")
async def get_travel_route(route_id: str):
    """Get route details"""
    db = get_database()
    route = await db.travel_routes.find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route["id"] = route.pop("_id")
    return route

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
    if current_user["role"] == "operator" and route["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in route_data.dict().items() if v is not None}
    
    # If editing an active route, set to pending for review
    if route.get("status") == RouteStatus.ACTIVE and current_user["role"] not in ["admin", "super_admin"]:
        update_data["status"] = RouteStatus.PENDING
        # Build edit summary for tracking
        changes = []
        for key in update_data:
            if key != "status" and route.get(key) != update_data[key]:
                changes.append(f"{key}: {route.get(key)} → {update_data[key]}")
        if changes:
            update_data["edited_field_message"] = f"Updated: {'; '.join(changes)}"
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.travel_routes.update_one({"_id": route_id}, {"$set": update_data})
    
    return {"message": "Route updated"}

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
    if current_user["role"] == "operator" and route["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check for active bookings
    active_bookings = await db.seat_bookings.count_documents({
        "route_id": route_id,
        "status": "booked",
        "travel_date": {"$gte": datetime.utcnow().strftime("%Y-%m-%d")}
    })
    
    if active_bookings > 0:
        raise HTTPException(status_code=400, detail="Cannot delete route with active bookings")
    
    await db.travel_routes.delete_one({"_id": route_id})
    
    return {"message": "Route deleted"}

@router.post("/routes/{route_id}/approve")
async def approve_route(
    route_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Approve a pending route (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.travel_routes.update_one(
        {"_id": route_id, "status": RouteStatus.PENDING},
        {"$set": {
            "status": RouteStatus.ACTIVE,
            "active": True,
            "edited_field_message": None,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Route not found or not pending")
    
    return {"message": "Route approved"}

@router.post("/routes/{route_id}/suspend")
async def suspend_route(
    route_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Suspend a route (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.travel_routes.update_one(
        {"_id": route_id},
        {"$set": {
            "status": RouteStatus.SUSPENDED,
            "active": False,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return {"message": "Route suspended"}

# Operator-specific routes
@router.get("/operator/routes")
async def get_operator_routes(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get routes for the current operator"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    
    if status:
        query["status"] = status
    
    routes = await db.travel_routes.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    return {"routes": routes, "total": total}

@router.get("/operator/stats")
async def get_operator_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get statistics for the current operator"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    
    total_routes = await db.travel_routes.count_documents(query)
    active_routes = await db.travel_routes.count_documents({**query, "status": RouteStatus.ACTIVE})
    pending_routes = await db.travel_routes.count_documents({**query, "status": RouteStatus.PENDING})
    
    vehicles_query = {} if current_user["role"] in ["admin", "super_admin"] else {"operator_id": current_user.get("operator_id")}
    total_vehicles = await db.vehicles.count_documents(vehicles_query)
    
    return {
        "total_routes": total_routes,
        "active_routes": active_routes,
        "pending_routes": pending_routes,
        "total_vehicles": total_vehicles
    }
