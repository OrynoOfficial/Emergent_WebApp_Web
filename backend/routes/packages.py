from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.package import PackageServiceCreate, PackageServiceUpdate, PackageStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/packages", tags=["Packages"])

@router.post("/")
async def create_package(
    package_data: PackageServiceCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new travel package"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    operator_id = package_data.operator_id or current_user.get("operator_id")
    operator_name = package_data.operator_name or current_user.get("operator_name", "")
    
    package = {
        "_id": str(uuid.uuid4()),
        **package_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": PackageStatus.DRAFT,
        "rating": 0,
        "total_reviews": 0,
        "total_bookings": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.packages.insert_one(package)
    
    return {"message": "Package created", "package_id": package["_id"]}

@router.get("/")
async def get_packages(
    destination: Optional[str] = None,
    country: Optional[str] = None,
    package_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    duration_days: Optional[int] = None,
    featured: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get travel packages - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"status": PackageStatus.ACTIVE}
    
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    if package_type:
        query["package_type"] = package_type
    if min_price:
        query["base_price"] = {"$gte": min_price}
    if max_price:
        query.setdefault("base_price", {})["$lte"] = max_price
    if duration_days:
        query["duration_days"] = duration_days
    if featured is not None:
        query["featured"] = featured
    
    # Apply country filter via operator lookup (packages has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        query.update(op_filter)
    
    packages = await db.packages.find(query).sort("rating", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.packages.count_documents(query)
    
    # Transform _id to id for each package
    for pkg in packages:
        pkg["id"] = str(pkg.pop("_id", ""))
    
    return {"packages": packages, "total": total}

@router.get("/{package_id}")
async def get_package(package_id: str):
    """Get package details"""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    package["id"] = package.pop("_id")
    return package

@router.put("/{package_id}")
async def update_package(
    package_id: str,
    package_data: PackageServiceUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a package"""
    db = get_database()
    
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    if current_user["role"] == "operator" and package["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in package_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.packages.update_one({"_id": package_id}, {"$set": update_data})
    
    return {"message": "Package updated"}

@router.delete("/{package_id}")
async def delete_package(
    package_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a package"""
    db = get_database()
    
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    if current_user["role"] == "operator" and package["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.packages.delete_one({"_id": package_id})
    
    return {"message": "Package deleted"}

@router.post("/{package_id}/publish")
async def publish_package(
    package_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Publish a package"""
    db = get_database()
    
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    if current_user["role"] == "operator" and package["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.packages.update_one(
        {"_id": package_id},
        {"$set": {"status": PackageStatus.ACTIVE, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Package published"}

@router.post("/{package_id}/book")
async def book_package(
    package_id: str,
    departure_date: str,
    travelers: int,
    traveler_details: List[dict],
    special_requests: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Book a travel package"""
    db = get_database()
    
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    if package["status"] != PackageStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Package not available")
    
    # Check departure date is available
    if package.get("departure_dates") and departure_date not in package["departure_dates"]:
        raise HTTPException(status_code=400, detail="Selected departure date not available")
    
    # Check traveler limits
    if travelers < package.get("min_travelers", 1):
        raise HTTPException(status_code=400, detail=f"Minimum {package['min_travelers']} travelers required")
    if package.get("max_travelers") and travelers > package["max_travelers"]:
        raise HTTPException(status_code=400, detail=f"Maximum {package['max_travelers']} travelers allowed")
    
    # Calculate price
    if package.get("price_per_person"):
        total_price = package["base_price"] * travelers
    else:
        total_price = package["base_price"]
    
    package_booking_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "package"})
    order_number = f"PKG-{order_count + 1:06d}"
    
    # Create service-specific booking
    booking = {
        "_id": package_booking_id,
        "order_id": order_id,  # Link to central order
        "package_id": package_id,
        "package_name": package["name"],
        "user_id": current_user["_id"],
        "departure_date": departure_date,
        "return_date": None,  # Calculate based on duration
        "travelers": travelers,
        "traveler_details": traveler_details,
        "special_requests": special_requests,
        "base_price": package["base_price"],
        "total_price": total_price,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.package_bookings.insert_one(booking)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "package",
        "service_booking_id": package_booking_id,
        "service_name": f"Package - {package['name']}",
        "service_id": package_id,
        "user_id": current_user["_id"],
        "operator_id": package.get("operator_id"),
        "operator_name": package.get("operator_name"),
        "total_amount": total_price,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "departure_date": departure_date,
            "travelers": travelers,
            "special_requests": special_requests,
            "destination": package.get("destination")
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    # Update booking count
    await db.packages.update_one(
        {"_id": package_id},
        {"$inc": {"total_bookings": 1}}
    )
    
    return {
        "message": "Package booked",
        "booking_id": package_booking_id,
        "order_id": order_id,
        "order_number": order_number,
        "total_price": total_price
    }

@router.get("/bookings/my")
async def get_my_package_bookings(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's package bookings"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    bookings = await db.package_bookings.find(query, {"_id": 0}).sort("departure_date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.package_bookings.count_documents(query)
    
    return {"bookings": bookings, "total": total}

@router.get("/operator/packages")
async def get_operator_packages(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get operator's packages"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    if status:
        query["status"] = status
    
    packages = await db.packages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.packages.count_documents(query)
    
    return {"packages": packages, "total": total}



@router.get("/management/my-services")
async def get_my_package_services(
    search: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get package services for the current user's operator (operator-scoped).
    Super admin and admin can see all services.
    Operator users can only see services belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    services = await db.package_services.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.package_services.count_documents(query)
    
    # Transform _id to id
    for service in services:
        service["id"] = str(service.pop("_id", ""))
    
    return {
        "services": services, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }

