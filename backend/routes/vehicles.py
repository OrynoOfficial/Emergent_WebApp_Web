from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.vehicle import VehicleCreate, VehicleUpdate
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])

@router.post("/")
async def create_vehicle(
    vehicle_data: VehicleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new vehicle"""
    db = get_database()
    
    # Check authorization
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Set operator info
    operator_id = vehicle_data.operator_id or current_user.get("operator_id")
    operator_name = vehicle_data.operator_name or current_user.get("operator_name", "")
    
    if not operator_id and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=400, detail="Operator ID required")
    
    vehicle = {
        "_id": str(uuid.uuid4()),
        **vehicle_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.vehicles.insert_one(vehicle)
    vehicle.pop("_id")
    vehicle["id"] = vehicle_data.operator_id
    
    return {"message": "Vehicle created", "vehicle_id": vehicle["_id"] if "_id" in vehicle else vehicle_data.operator_id, "vehicle": vehicle}

@router.get("/")
async def get_vehicles(
    operator_id: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    maintenance_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get vehicles with optional filters"""
    db = get_database()
    
    query = {}
    
    # Filter by operator for non-admin users
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    elif operator_id:
        query["operator_id"] = operator_id
    
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    if maintenance_status:
        query["maintenance_status"] = maintenance_status
    
    vehicles = await db.vehicles.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.vehicles.count_documents(query)
    
    # Transform _id to id for each vehicle
    for v in vehicles:
        v["id"] = str(v.pop("_id", ""))
    
    return {"vehicles": vehicles, "total": total, "skip": skip, "limit": limit}

@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    """Get vehicle details"""
    db = get_database()
    vehicle = await db.vehicles.find_one({"_id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle["id"] = vehicle_id
    return vehicle

@router.put("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    vehicle_data: VehicleUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a vehicle"""
    db = get_database()
    
    vehicle = await db.vehicles.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check authorization
    if current_user["role"] == "operator" and vehicle["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in vehicle_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.vehicles.update_one({"_id": vehicle_id}, {"$set": update_data})
    
    return {"message": "Vehicle updated"}

@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a vehicle"""
    db = get_database()
    
    vehicle = await db.vehicles.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check authorization
    if current_user["role"] == "operator" and vehicle["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if vehicle is used in any active routes
    active_routes = await db.travel_routes.count_documents({"vehicle_id": vehicle_id, "active": True})
    if active_routes > 0:
        raise HTTPException(status_code=400, detail="Cannot delete vehicle with active routes")
    
    await db.vehicles.delete_one({"_id": vehicle_id})
    
    return {"message": "Vehicle deleted"}
