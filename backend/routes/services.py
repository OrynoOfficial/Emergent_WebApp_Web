from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.service import Service, ServiceCreate, ServiceCategory, ServiceStatus
from config.database import get_database
from middleware.auth import get_current_active_user
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/services", tags=["Services"])

@router.post("/", response_model=dict)
async def create_service(
    service_data: ServiceCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new service"""
    db = get_database()
    
    # Only operators and admins can create services
    if current_user["role"] not in ["operator", "admin", "super_admin", "service_provider"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create services"
        )
    
    service = {
        "_id": str(uuid.uuid4()),
        **service_data.dict(),
        "operator_id": current_user["_id"],
        "status": ServiceStatus.PENDING_APPROVAL if current_user["role"] != "admin" else ServiceStatus.ACTIVE,
        "is_available": True,
        "average_rating": 0.0,
        "total_ratings": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.services.insert_one(service)
    
    return {"message": "Service created successfully", "service_id": service["_id"]}

@router.get("/")
async def get_services(
    category: Optional[ServiceCategory] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    is_available: Optional[bool] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get all services with filters"""
    db = get_database()
    
    # Build query
    query = {"status": ServiceStatus.ACTIVE}
    if category:
        query["category"] = category
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    if is_available is not None:
        query["is_available"] = is_available
    
    services = await db.services.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.services.count_documents(query)
    
    return {
        "services": services,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{service_id}")
async def get_service(service_id: str):
    """Get a specific service"""
    db = get_database()
    
    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    return service

@router.put("/{service_id}")
async def update_service(
    service_id: str,
    service_data: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a service"""
    db = get_database()
    
    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Check authorization
    if current_user["role"] != "admin" and service["operator_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this service"
        )
    
    service_data["updated_at"] = datetime.utcnow()
    await db.services.update_one({"_id": service_id}, {"$set": service_data})
    
    return {"message": "Service updated successfully"}

@router.delete("/{service_id}")
async def delete_service(
    service_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a service"""
    db = get_database()
    
    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Check authorization
    if current_user["role"] != "admin" and service["operator_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this service"
        )
    
    await db.services.delete_one({"_id": service_id})
    
    return {"message": "Service deleted successfully"}