from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.pressing import PressingCreate, PressingUpdate, LaundryStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/pressing", tags=["Laundry/Pressing"])

@router.post("/")
async def create_pressing(
    pressing_data: PressingCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new pressing/laundry service"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    operator_id = pressing_data.operator_id or current_user.get("operator_id")
    operator_name = pressing_data.operator_name or current_user.get("operator_name", "")
    
    pressing = {
        "_id": str(uuid.uuid4()),
        **pressing_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": LaundryStatus.ACTIVE,
        "rating": 0,
        "total_reviews": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.pressings.insert_one(pressing)
    
    return {"message": "Pressing service created", "pressing_id": pressing["_id"]}

@router.get("/")
async def get_pressings(
    city: Optional[str] = None,
    delivery_available: Optional[bool] = None,
    express_available: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get pressing services"""
    db = get_database()
    
    query = {"status": LaundryStatus.ACTIVE}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if delivery_available is not None:
        query["delivery_available"] = delivery_available
    if express_available is not None:
        query["express_available"] = express_available
    
    pressings = await db.pressings.find(query).sort("rating", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pressings.count_documents(query)
    
    # Transform _id to id for each pressing
    for pressing in pressings:
        pressing["id"] = str(pressing.pop("_id", ""))
    
    return {"pressings": pressings, "total": total}

@router.get("/{pressing_id}")
async def get_pressing(pressing_id: str):
    """Get pressing service details"""
    db = get_database()
    pressing = await db.pressings.find_one({"_id": pressing_id})
    if not pressing:
        raise HTTPException(status_code=404, detail="Pressing service not found")
    pressing["id"] = pressing.pop("_id")
    return pressing

@router.put("/{pressing_id}")
async def update_pressing(
    pressing_id: str,
    pressing_data: PressingUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a pressing service"""
    db = get_database()
    
    pressing = await db.pressings.find_one({"_id": pressing_id})
    if not pressing:
        raise HTTPException(status_code=404, detail="Pressing service not found")
    
    if current_user["role"] == "operator" and pressing["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in pressing_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.pressings.update_one({"_id": pressing_id}, {"$set": update_data})
    
    return {"message": "Pressing service updated"}

@router.delete("/{pressing_id}")
async def delete_pressing(
    pressing_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a pressing service"""
    db = get_database()
    
    pressing = await db.pressings.find_one({"_id": pressing_id})
    if not pressing:
        raise HTTPException(status_code=404, detail="Pressing service not found")
    
    if current_user["role"] == "operator" and pressing["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.pressings.delete_one({"_id": pressing_id})
    
    return {"message": "Pressing service deleted"}

@router.post("/{pressing_id}/orders")
async def create_laundry_order(
    pressing_id: str,
    items: List[dict],
    delivery_requested: bool = False,
    express_requested: bool = False,
    pickup_address: Optional[str] = None,
    delivery_address: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a laundry order"""
    db = get_database()
    
    pressing = await db.pressings.find_one({"_id": pressing_id})
    if not pressing:
        raise HTTPException(status_code=404, detail="Pressing service not found")
    
    # Calculate total
    subtotal = 0
    for item in items:
        service = next((s for s in pressing.get("services", []) if s["name"] == item["service"]), None)
        if service:
            item["price"] = service["price"]
            item["total"] = service["price"] * item.get("quantity", 1)
            subtotal += item["total"]
    
    delivery_fee = pressing.get("delivery_fee", 0) if delivery_requested else 0
    express_fee = pressing.get("express_surcharge", 0) if express_requested else 0
    total = subtotal + delivery_fee + express_fee
    
    laundry_order_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "laundry"})
    order_number = f"LAU-{order_count + 1:06d}"
    
    # Create service-specific order
    laundry_order = {
        "_id": laundry_order_id,
        "order_id": order_id,  # Link to central order
        "pressing_id": pressing_id,
        "pressing_name": pressing["name"],
        "user_id": current_user["_id"],
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "express_fee": express_fee,
        "total": total,
        "delivery_requested": delivery_requested,
        "express_requested": express_requested,
        "pickup_address": pickup_address,
        "delivery_address": delivery_address,
        "notes": notes,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.laundry_orders.insert_one(laundry_order)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "laundry",
        "service_booking_id": laundry_order_id,
        "service_name": f"Laundry - {pressing['name']}",
        "service_id": pressing_id,
        "user_id": current_user["_id"],
        "operator_id": pressing.get("operator_id"),
        "operator_name": pressing.get("operator_name"),
        "total_amount": total,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "items": items,
            "delivery_requested": delivery_requested,
            "express_requested": express_requested,
            "pickup_address": pickup_address,
            "delivery_address": delivery_address
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    return {
        "message": "Order created",
        "order_id": order_id,
        "laundry_order_id": laundry_order_id,
        "order_number": order_number,
        "total": total,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "express_fee": express_fee
    }

@router.get("/orders/my")
async def get_my_laundry_orders(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's laundry orders"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    orders = await db.laundry_orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.laundry_orders.count_documents(query)
    
    return {"orders": orders, "total": total}



@router.get("/management/my-shops")
async def get_my_laundry_shops(
    search: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get laundry shops for the current user's operator (operator-scoped).
    Super admin and admin can see all shops.
    Operator users can only see shops belonging to their operator.
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
    
    shops = await db.laundry_shops.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.laundry_shops.count_documents(query)
    
    # Transform _id to id
    for shop in shops:
        shop["id"] = str(shop.pop("_id", ""))
    
    return {
        "shops": shops, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }

