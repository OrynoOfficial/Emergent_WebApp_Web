from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/car-rental", tags=["Car Rental"])

class CarRentalCreate(BaseModel):
    make: str
    model: str
    year: int
    vehicle_type: str
    seats: int
    doors: int
    transmission: str
    fuel_type: str
    price_per_day: float
    price_per_hour: Optional[float] = None
    city: Optional[str] = None
    features: Optional[list] = []
    images: Optional[list] = []
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    # Rich fields (iter 224+)
    description: Optional[str] = None
    mileage_policy: Optional[str] = None
    fuel_policy: Optional[str] = None
    minimum_driver_age: Optional[int] = None
    min_rental_days: Optional[int] = None
    max_rental_days: Optional[int] = None
    pickup_locations: Optional[list] = []
    pickup_address: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lon: Optional[float] = None
    trunk_capacity: Optional[str] = None
    fuel_consumption: Optional[str] = None
    # Policies (iter 230)
    policies: Optional[list] = []
    # Inventory total units (iter 230) — drives "almost sold out" logic
    total_units: Optional[int] = 1
    # Listing-level refund policy override (overrides operator default)
    refund_policy: Optional[dict] = None

@router.post("/")
async def create_car(
    car_data: CarRentalCreate,
    current_user: dict = Depends(require_permission("car_rental.create"))
):
    """Create a new car rental - requires car_rental.create permission"""
    db = get_database()
    
    # Use provided operator_id or default to current user
    operator_id = car_data.operator_id or current_user["_id"]
    operator_name = car_data.operator_name or ""
    
    # If operator_id provided but no name, try to fetch it
    if operator_id and not operator_name:
        operator = await db.operators.find_one({"_id": operator_id})
        if operator:
            operator_name = operator.get("name", "")
    
    car = {
        "_id": str(uuid.uuid4()),
        **car_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "is_available": True,
        "average_rating": 0.0,
        "total_ratings": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.car_rentals.insert_one(car)
    return {"message": "Car created", "car_id": car["_id"]}

@router.get("/")
async def get_cars(
    vehicle_type: Optional[str] = None,
    transmission: Optional[str] = None,
    country: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get available cars - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"is_available": True}
    if operator_id:
        query["operator_id"] = operator_id
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    if transmission:
        query["transmission"] = transmission
    
    # Apply country filter via operator lookup (car_rentals has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        query.update(op_filter)
    
    cars = await db.car_rentals.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.car_rentals.count_documents(query)

    # --- Operator brand enrichment ---------------------------------------
    # Single batch lookup so each car carries its operator's logo_url for the
    # customer-facing CarRentalResults / CarRentalDetails owner tab.
    op_ids = list({c.get("operator_id") for c in cars if c.get("operator_id")})
    logo_map = {}
    if op_ids:
        async for op in db.operators.find({"_id": {"$in": op_ids}}, {"_id": 1, "logo_url": 1}):
            logo_map[op["_id"]] = op.get("logo_url")
    for c in cars:
        if c.get("operator_id") in logo_map:
            c["operator_logo_url"] = logo_map[c["operator_id"]]

    # --- FOMO inventory enrichment ---------------------------------------
    # Each car_rentals row = 1 vehicle. For the "Almost sold out" badge to be
    # meaningful, we expose `units_available` per (operator_id, vehicle_type)
    # bucket — i.e. "how many comparable vehicles are still bookable right now".
    # Computed with a single aggregation across all buckets present on this page.
    buckets = {(c.get("operator_id"), c.get("vehicle_type")) for c in cars}
    buckets.discard((None, None))
    if buckets:
        bucket_filter = {
            "$or": [
                {"operator_id": op, "vehicle_type": vt}
                for (op, vt) in buckets if op and vt
            ]
        }
        # Total available vehicles per bucket
        total_by_bucket_agg = await db.car_rentals.aggregate([
            {"$match": {**bucket_filter, "is_available": True}},
            {"$group": {
                "_id": {"op": "$operator_id", "vt": "$vehicle_type"},
                "total": {"$sum": 1},
            }}
        ]).to_list(None)
        total_by_bucket = {
            (row["_id"]["op"], row["_id"]["vt"]): row["total"]
            for row in total_by_bucket_agg
        }
        # Active bookings (orders) per car_id today
        active_booked_agg = await db.orders.aggregate([
            {"$match": {
                "service_category": "car_rental",
                "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
            }},
            {"$group": {"_id": "$service_id"}}
        ]).to_list(None)
        booked_car_ids = {row["_id"] for row in active_booked_agg if row.get("_id")}
        # Booked counts per bucket: re-query car_rentals filtered to booked_car_ids
        booked_by_bucket: dict = {}
        if booked_car_ids:
            booked_by_bucket_agg = await db.car_rentals.aggregate([
                {"$match": {"_id": {"$in": list(booked_car_ids)}, **bucket_filter}},
                {"$group": {
                    "_id": {"op": "$operator_id", "vt": "$vehicle_type"},
                    "booked": {"$sum": 1},
                }}
            ]).to_list(None)
            booked_by_bucket = {
                (row["_id"]["op"], row["_id"]["vt"]): row["booked"]
                for row in booked_by_bucket_agg
            }
        # Attach units_available to each car
        for c in cars:
            key = (c.get("operator_id"), c.get("vehicle_type"))
            if key in total_by_bucket:
                avail = max(0, total_by_bucket[key] - booked_by_bucket.get(key, 0))
                c["units_available"] = avail

    return {"cars": cars, "total": total}

@router.get("/{car_id}")
async def get_car(car_id: str):
    """Get car details"""
    db = get_database()
    car = await db.car_rentals.find_one({"_id": car_id})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    car["id"] = str(car.pop("_id", ""))
    # Operator brand on the customer-facing details page.
    if car.get("operator_id"):
        op = await db.operators.find_one({"_id": car["operator_id"]}, {"logo_url": 1})
        if op and op.get("logo_url"):
            car["operator_logo_url"] = op["logo_url"]
    return car


class CarRentalUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vehicle_type: Optional[str] = None
    seats: Optional[int] = None
    doors: Optional[int] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    price_per_day: Optional[float] = None
    price_per_hour: Optional[float] = None
    city: Optional[str] = None
    features: Optional[list] = None
    images: Optional[list] = None
    is_available: Optional[bool] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    description: Optional[str] = None
    mileage_policy: Optional[str] = None
    fuel_policy: Optional[str] = None
    minimum_driver_age: Optional[int] = None
    min_rental_days: Optional[int] = None
    max_rental_days: Optional[int] = None
    pickup_locations: Optional[list] = None
    pickup_address: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lon: Optional[float] = None
    trunk_capacity: Optional[str] = None
    fuel_consumption: Optional[str] = None
    policies: Optional[list] = None
    total_units: Optional[int] = None
    refund_policy: Optional[dict] = None


@router.put("/{car_id}")
async def update_car(
    car_id: str,
    car_data: CarRentalUpdate,
    current_user: dict = Depends(require_permission("car_rental.edit"))
):
    """Update a car rental - requires car_rental.edit permission"""
    db = get_database()
    
    car = await db.car_rentals.find_one({"_id": car_id})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Check authorization for operators (can only edit their own)
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if car.get("operator_id") != current_user.get("_id"):
            raise HTTPException(status_code=403, detail="You can only edit your own cars")
    
    update_data = {k: v for k, v in car_data.dict().items() if v is not None}
    
    # If operator_id is being updated, fetch the operator name
    if "operator_id" in update_data and update_data["operator_id"]:
        if not update_data.get("operator_name"):
            operator = await db.operators.find_one({"_id": update_data["operator_id"]})
            if operator:
                update_data["operator_name"] = operator.get("name", "")
    
    # Operators cannot set status to active; data changes reset to pending
    is_operator = user_role not in ["admin", "super_admin"]
    if is_operator:
        update_data.pop("status", None)
        data_fields = {k for k in update_data if k not in ("updated_at",)}
        if data_fields:
            update_data["status"] = "pending"
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.car_rentals.update_one({"_id": car_id}, {"$set": update_data})
    
    return {"message": "Car updated"}


@router.delete("/{car_id}")
async def delete_car(
    car_id: str,
    current_user: dict = Depends(require_permission("car_rental.delete"))
):
    """Delete a car rental - requires car_rental.delete permission"""
    db = get_database()
    
    car = await db.car_rentals.find_one({"_id": car_id})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Check authorization for operators (can only delete their own)
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        if car.get("operator_id") != current_user.get("_id"):
            raise HTTPException(status_code=403, detail="You can only delete your own cars")
    
    # Check for active bookings
    active_bookings = await db.car_rental_bookings.count_documents({
        "vehicle_id": car_id,
        "status": {"$in": ["pending", "confirmed"]}
    })
    
    if active_bookings > 0:
        raise HTTPException(status_code=400, detail="Cannot delete car with active bookings")
    
    await db.car_rentals.delete_one({"_id": car_id})
    
    return {"message": "Car deleted"}


class CarRentalBookingCreate(BaseModel):
    vehicle_id: str
    vehicle_name: str
    pickup_date: str
    return_date: str
    pickup_location: Optional[str] = None
    driver_name: str
    driver_email: str
    driver_phone: str
    driver_license: str
    driver_address: Optional[str] = None
    extras: list = []
    base_price: float
    extras_price: float = 0
    commission: float = 0
    total_amount: float


@router.post("/book")
async def create_car_rental_booking(
    booking_data: CarRentalBookingCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a car rental booking + reserve an inventory hold so the
    available_units count drops in real time. Mirrors the banquet flow."""
    db = get_database()

    # Stock check using the same engine that powers banquet rentals.
    from routes.inventory import _entity_available_units, _refresh_available  # local import
    vehicle = await db.car_rentals.find_one({"_id": booking_data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    avail = await _entity_available_units(db, "car_rental", booking_data.vehicle_id)
    if avail < 1:
        raise HTTPException(status_code=409, detail=f"'{vehicle.get('make','')} {vehicle.get('model','')}' is fully booked for the requested period.")

    # Generate booking number
    booking_count = await db.orders.count_documents({"service_category": "car_rental"})
    booking_number = f"CAR-{booking_count + 1:06d}"

    booking = {
        "_id": str(uuid.uuid4()),
        "booking_number": booking_number,
        "user_id": current_user["_id"],
        "service_category": "car_rental",
        "service_name": f"Car Rental - {booking_data.vehicle_name}",
        "vehicle_id": booking_data.vehicle_id,
        "vehicle_name": booking_data.vehicle_name,
        "pickup_date": booking_data.pickup_date,
        "return_date": booking_data.return_date,
        "pickup_location": booking_data.pickup_location,
        "driver_name": booking_data.driver_name,
        "driver_email": booking_data.driver_email,
        "driver_phone": booking_data.driver_phone,
        "driver_license": booking_data.driver_license,
        "driver_address": booking_data.driver_address,
        "extras": booking_data.extras,
        "base_price": booking_data.base_price,
        "extras_price": booking_data.extras_price,
        "commission": booking_data.commission,
        "total_amount": booking_data.total_amount,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.orders.insert_one(booking)

    # Create inventory hold (1 unit per car booking).
    hold_doc = {
        "_id": str(uuid.uuid4()),
        "entity_type": "car_rental",
        "entity_id": booking_data.vehicle_id,
        "operator_id": vehicle.get("operator_id"),
        "booking_id": booking["_id"],
        "customer_id": current_user["_id"],
        "customer_name": booking_data.driver_name,
        "unit_ids": [],
        "quantity": 1,
        "start_date": booking_data.pickup_date,
        "end_date": booking_data.return_date,
        "status": "reserved",
        "damaged_quantity": 0,
        "damage_fee": 0.0,
        "damage_description": None,
        "operator_note": None,
        "item_name": f"{vehicle.get('make','')} {vehicle.get('model','')}".strip(),
        "unit_price": float(vehicle.get("price_per_day") or 0),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.inventory_holds.insert_one(hold_doc)
    await _refresh_available(db, "car_rental", booking_data.vehicle_id)

    return {
        "success": True,
        "message": "Car rental booked successfully",
        "booking_id": booking["_id"],
        "booking_number": booking_number,
        "inventory_hold_id": hold_doc["_id"],
    }


@router.get("/bookings/my")
async def get_my_car_bookings(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's car rental bookings"""
    db = get_database()
    
    bookings = await db.orders.find(
        {"user_id": current_user["_id"], "service_category": "car_rental"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.orders.count_documents(
        {"user_id": current_user["_id"], "service_category": "car_rental"}
    )
    
    return {"bookings": bookings, "total": total}




@router.get("/management/my-vehicles")
async def get_my_vehicles(
    search: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    city: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get vehicles for the current user's operator (operator-scoped).
    Super admin and admin can see all vehicles.
    Operator users can only see vehicles belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    if operator_id and current_user.get("role") in ("super_admin", "admin"):
        query["operator_id"] = operator_id
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"make": {"$regex": search, "$options": "i"}},
            {"model": {"$regex": search, "$options": "i"}}
        ]
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    vehicles = await db.car_rentals.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.car_rentals.count_documents(query)
    
    # Transform _id to id
    for vehicle in vehicles:
        vehicle["id"] = str(vehicle.pop("_id", ""))
    
    return {
        "vehicles": vehicles, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }