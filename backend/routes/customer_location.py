"""
Customer Location Routes
Implements dynamic location-aware content filtering for customers
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.geolocation import (
    CustomerLocationContext, 
    resolve_customer_location,
    is_african_country,
    get_location_data
)
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/api/customer-location", tags=["Customer Location"])


@router.get("/resolve")
async def resolve_location(
    request: Request,
    gps_lat: Optional[float] = Query(None, description="GPS latitude"),
    gps_lng: Optional[float] = Query(None, description="GPS longitude"),
    manual_country: Optional[str] = Query(None, description="Manual country override"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Resolve customer's current location for content filtering.
    
    Priority:
    1. Manual override (if provided)
    2. GPS coordinates (if provided)
    3. IP geolocation
    4. SIM/phone country (from user profile)
    5. Profile country (registration)
    
    Returns visibility scope:
    - "country": If in Africa, show only operators in current country
    - "global": If outside Africa, show all operators
    """
    # Get client IP
    client_ip = request.client.host
    
    # Resolve location
    location_context = resolve_customer_location(
        request_ip=client_ip,
        user=current_user,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        manual_country=manual_country
    )
    
    return {
        "location": location_context.to_dict(),
        "operator_filter": location_context.get_operator_filter()
    }


@router.get("/services")
async def get_location_filtered_services(
    request: Request,
    service_type: Optional[str] = Query(None, description="Filter by service type"),
    gps_lat: Optional[float] = Query(None),
    gps_lng: Optional[float] = Query(None),
    manual_country: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get operators/services filtered by customer's current location.
    
    Visibility Rules:
    - If in Africa: Show only operators in current country
    - If outside Africa: Show all operators globally
    """
    db = get_database()
    client_ip = request.client.host
    
    # Resolve location
    location_context = resolve_customer_location(
        request_ip=client_ip,
        user=current_user,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        manual_country=manual_country
    )
    
    # Build query with location filter
    query = {"status": "active"}
    
    # Apply location filter
    location_filter = location_context.get_operator_filter()
    if location_filter:
        query.update(location_filter)
    
    # Apply service type filter
    if service_type:
        query["$or"] = [
            {"operator_type": service_type},
            {"service_types": service_type}
        ]
    
    # Get operators
    operators = await db.operators.find(
        query,
        {"password_hash": 0, "documents": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.operators.count_documents(query)
    
    # Convert _id to id
    for op in operators:
        op["id"] = op.pop("_id")
    
    return {
        "location": location_context.to_dict(),
        "operators": operators,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/update-profile-location")
async def update_profile_location(
    request: Request,
    country_code: str = Query(..., description="Country code to save"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Update user's profile with their preferred/selected country.
    This is used as fallback in location resolution.
    """
    db = get_database()
    
    # Validate country code
    country = await db.countries.find_one({"code": country_code.upper()})
    if not country:
        raise HTTPException(status_code=400, detail="Invalid country code")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            "country": country_code.upper(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Profile location updated",
        "country": country_code.upper(),
        "country_name": country["name"]
    }


@router.get("/supported-countries")
async def get_supported_countries(
    current_user: dict = Depends(get_current_active_user)
):
    """Get list of countries where Oryno operates"""
    db = get_database()
    
    countries = await db.countries.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "code": 1, "name": 1, "phone_code": 1, "currency_code": 1}
    ).sort("name", 1).to_list(500)
    
    return {"countries": countries}


@router.get("/ip-info")
async def get_ip_info(request: Request):
    """
    Get location information from client IP.
    Public endpoint for location detection before login.
    """
    client_ip = request.client.host
    
    location_data = get_location_data(client_ip)
    
    return {
        "ip": client_ip,
        "location": location_data,
        "is_in_africa": is_african_country(location_data.get("country_code"))
    }
