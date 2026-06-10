from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.pressing import (
    PressingCreate, PressingUpdate, LaundryStatus, ShopType,
    DEFAULT_PRESSING_ITEM_PRESETS,
)
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/pressing", tags=["Laundry/Pressing"])


def _sanitize_pricing(payload: dict) -> dict:
    """Make sure the pricing fields stored on the shop document are coherent
    with the chosen `shop_type`. A laundry-only shop has no item_prices; a
    pressing-only shop has no price_per_kg. This is enforced server-side so we
    can't end up with leftover stale data if the operator flips between modes
    in the UI."""
    st = payload.get("shop_type")
    if st == ShopType.LAUNDRY.value or st == ShopType.LAUNDRY:
        payload["item_prices"] = []
    elif st == ShopType.PRESSING.value or st == ShopType.PRESSING:
        payload["price_per_kg"] = None
    return payload

@router.post("/")
async def create_pressing(
    pressing_data: PressingCreate,
    current_user: dict = Depends(require_any_permission(["pressing.create", "operator.services.create"]))
):
    """Create a new pressing/laundry service - requires pressing.create permission"""
    db = get_database()
    
    operator_id = pressing_data.operator_id or current_user.get("operator_id")
    operator_name = pressing_data.operator_name or current_user.get("operator_name", "")
    
    payload = pressing_data.dict(exclude={"operator_id", "operator_name"})
    payload = _sanitize_pricing(payload)
    pressing = {
        "_id": str(uuid.uuid4()),
        **payload,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": LaundryStatus.ACTIVE,
        "rating": 0,
        "total_reviews": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.pressings.insert_one(pressing)
    
    return {
        "message": "Pressing service created",
        "pressing_id": pressing["_id"],
        "shop_id": pressing["_id"],
    }


@router.get("/item-presets")
async def get_pressing_item_presets():
    """Return the default catalog of per-item pressing labels surfaced as
    quick-add suggestions on the create-shop modal. The frontend renders these
    as clickable chips; operators can still type custom items."""
    return {"presets": DEFAULT_PRESSING_ITEM_PRESETS}

@router.get("/")
async def get_pressings(
    city: Optional[str] = None,
    country: Optional[str] = None,
    delivery_available: Optional[bool] = None,
    express_available: Optional[bool] = None,
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get pressing services - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"status": LaundryStatus.ACTIVE}
    
    if operator_id:
        query["operator_id"] = operator_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if delivery_available is not None:
        query["delivery_available"] = delivery_available
    if express_available is not None:
        query["express_available"] = express_available
    
    # Apply country filter via operator lookup (pressings has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        query.update(op_filter)
    
    pressings = await db.pressings.find(query).sort("rating", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pressings.count_documents(query)
    
    # Transform _id to id for each pressing
    for pressing in pressings:
        pressing["id"] = str(pressing.pop("_id", ""))

    # --- FOMO inventory enrichment ---------------------------------------
    # Pressings can configure `max_orders_per_day` (or legacy
    # `pickup_slots_per_day`) on their shop document. If present, we expose
    # `slots_available` = max(0, capacity - today's active orders). Shops
    # without a daily-capacity field gracefully omit the field — badge
    # renders nothing until they configure it.
    if pressings:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today_start + timedelta(days=1)
        capacity_by_shop = {}
        for p in pressings:
            cap = p.get("max_orders_per_day") or p.get("pickup_slots_per_day")
            if isinstance(cap, (int, float)) and cap > 0:
                capacity_by_shop[p["id"]] = int(cap)
        if capacity_by_shop:
            taken_agg = await db.orders.aggregate([
                {"$match": {
                    "service_category": {"$in": ["pressing", "laundry"]},
                    "service_id": {"$in": list(capacity_by_shop.keys())},
                    "created_at": {"$gte": today_start, "$lt": tomorrow},
                    "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
                }},
                {"$group": {"_id": "$service_id", "count": {"$sum": 1}}}
            ]).to_list(None)
            taken_by_shop = {row["_id"]: row["count"] for row in taken_agg}
            for p in pressings:
                cap = capacity_by_shop.get(p["id"])
                if cap is not None:
                    p["slots_available"] = max(0, cap - taken_by_shop.get(p["id"], 0))
    
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
    current_user: dict = Depends(require_any_permission(["pressing.edit", "operator.services.edit"]))
):
    """Update a pressing service - requires pressing.edit permission"""
    db = get_database()
    
    pressing = await db.pressings.find_one({"_id": pressing_id})
    if not pressing:
        raise HTTPException(status_code=404, detail="Pressing service not found")
    
    if current_user["role"] == "operator" and pressing["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in pressing_data.dict().items() if v is not None}
    if "shop_type" in update_data:
        update_data = _sanitize_pricing(update_data)
    
    if current_user["role"] == "operator":
        update_data.pop("status", None)
        if {k for k in update_data if k not in ("updated_at",)}:
            update_data["status"] = "pending"
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.pressings.update_one({"_id": pressing_id}, {"$set": update_data})
    
    return {"message": "Pressing service updated"}

@router.delete("/{pressing_id}")
async def delete_pressing(
    pressing_id: str,
    current_user: dict = Depends(require_any_permission(["pressing.delete", "operator.services.delete"]))
):
    """Delete a pressing service - requires pressing.delete permission"""
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
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get laundry/pressing shops for the current user's operator (operator-scoped).
    Super admin and admin can see all shops.
    Operator users can only see shops belonging to their operator.

    Reads from `db.pressings` — the same collection POST/PUT/DELETE write to.
    (Historically, an older `db.laundry_shops` collection was used here, but
    nothing wrote to it, so the management list was always empty regardless of
    how many shops the operator had created.)
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
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    shops = await db.pressings.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.pressings.count_documents(query)
    
    # Transform _id to id (mirrors GET / behaviour). Default missing modern
    # fields so legacy rows render cleanly on the new UI.
    for shop in shops:
        shop["id"] = str(shop.pop("_id", ""))
        shop.setdefault("shop_type", "laundry")
        shop.setdefault("item_prices", [])
        shop.setdefault("services", [])
        shop.setdefault("operating_hours", {})
        shop.setdefault("images", [])
        shop.setdefault("accepts_momo", True)
        shop.setdefault("accepts_cash", True)
        shop.setdefault("accepts_card", False)
        shop.setdefault("turnaround_hours", 24)
    
    return {
        "shops": shops, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }

