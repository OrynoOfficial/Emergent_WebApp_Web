from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.promo_code import PromoCodeCreate, PromoCodeValidate
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/promo-codes", tags=["Promo Codes"])

@router.post("/")
async def create_promo_code(
    promo_data: PromoCodeCreate,
    current_user: dict = Depends(require_any_permission(["promo.create"]))
):
    """Create a promo code - requires promo.create permission"""
    db = get_database()
    
    # Check if code already exists
    existing = await db.promo_codes.find_one({"code": promo_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo = {
        "_id": str(uuid.uuid4()),
        **promo_data.dict(),
        "code": promo_data.code.upper(),
        "times_used": 0,
        "is_active": True,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Set operator_id for operator-created codes
    if current_user["role"] == "operator":
        promo["operator_id"] = current_user.get("operator_id")
        promo["operator_name"] = current_user.get("operator_name")
    
    await db.promo_codes.insert_one(promo)
    
    return {"message": "Promo code created", "code": promo["code"]}

@router.post("/validate")
async def validate_promo_code(
    validation: PromoCodeValidate,
    current_user: dict = Depends(get_current_active_user)
):
    """Validate a promo code"""
    db = get_database()
    
    promo = await db.promo_codes.find_one({
        "code": validation.code.upper(),
        "is_active": True
    })
    
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid promo code")
    
    now = datetime.utcnow().isoformat()
    
    # Check validity dates
    if promo["valid_from"] > now:
        raise HTTPException(status_code=400, detail="Promo code not yet active")
    if promo["valid_to"] < now:
        raise HTTPException(status_code=400, detail="Promo code expired")
    
    # Check usage limit
    if promo.get("usage_limit") and promo["times_used"] >= promo["usage_limit"]:
        raise HTTPException(status_code=400, detail="Promo code usage limit reached")
    
    # Check per-user limit
    user_uses = await db.promo_code_uses.count_documents({
        "promo_code": promo["code"],
        "user_id": current_user["_id"]
    })
    if user_uses >= promo.get("per_user_limit", 1):
        raise HTTPException(status_code=400, detail="You have already used this promo code")
    
    # Check operator scope — promotion-redeemed codes only work for that operator
    # If the code is operator-scoped, require the booking to be for the same operator
    if promo.get("operator_id"):
        if not validation.operator_id:
            raise HTTPException(status_code=400, detail=f"This promo code is only valid for {promo.get('operator_name', 'a specific operator')}'s services")
        if promo["operator_id"] != validation.operator_id:
            raise HTTPException(status_code=400, detail=f"This promo code is only valid for {promo.get('operator_name', 'a specific operator')}'s services")

    # Check service type
    if promo.get("service_types") and validation.service_type:
        if validation.service_type not in promo["service_types"]:
            raise HTTPException(status_code=400, detail="Promo code not valid for this service")
    
    # Check minimum order amount
    if promo.get("min_order_amount") and validation.order_amount:
        if validation.order_amount < promo["min_order_amount"]:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order amount is {promo['min_order_amount']} XAF"
            )
    
    # Check first order only
    if promo.get("first_order_only"):
        user_orders = await db.orders.count_documents({"user_id": current_user["_id"]})
        if user_orders > 0:
            raise HTTPException(status_code=400, detail="Promo code is for first order only")
    
    # Calculate discount
    discount = 0
    if validation.order_amount:
        if promo["discount_type"] == "percentage":
            discount = validation.order_amount * (promo["discount_value"] / 100)
            if promo.get("max_discount_amount") and discount > promo["max_discount_amount"]:
                discount = promo["max_discount_amount"]
        else:
            discount = promo["discount_value"]
    
    return {
        "valid": True,
        "code": promo["code"],
        "name": promo["name"],
        "discount_type": promo["discount_type"],
        "discount_value": promo["discount_value"],
        "discount_amount": round(discount, 2) if validation.order_amount else None,
        "max_discount": promo.get("max_discount_amount"),
        "operator_id": promo.get("operator_id"),
        "operator_name": promo.get("operator_name"),
        "service_types": promo.get("service_types", [])
    }

@router.post("/use")
async def use_promo_code(
    code: str,
    order_id: str,
    discount_amount: float,
    current_user: dict = Depends(get_current_active_user)
):
    """Record promo code usage and update linked loyalty redemption status"""
    db = get_database()
    
    # Record usage
    usage = {
        "_id": str(uuid.uuid4()),
        "promo_code": code.upper(),
        "user_id": current_user["_id"],
        "order_id": order_id,
        "discount_amount": discount_amount,
        "used_at": datetime.utcnow()
    }
    await db.promo_code_uses.insert_one(usage)
    
    # Increment usage count on promo code
    promo = await db.promo_codes.find_one({"code": code.upper()})
    if promo:
        new_times_used = promo.get("times_used", 0) + 1
        update_fields = {"times_used": new_times_used, "updated_at": datetime.utcnow()}
        
        # Deactivate if usage limit reached
        if promo.get("usage_limit") and new_times_used >= promo["usage_limit"]:
            update_fields["is_active"] = False
        
        await db.promo_codes.update_one({"code": code.upper()}, {"$set": update_fields})
        
        # If this promo came from a loyalty redemption, update the redemption status to "used"
        if promo.get("source") == "loyalty_redemption" and promo.get("redemption_id"):
            await db.loyalty_redemptions.update_one(
                {"_id": promo["redemption_id"]},
                {"$set": {"status": "used", "used_at": datetime.utcnow(), "used_in_order": order_id}}
            )

        # If this promo came from an operator promotion redemption, update status to "used"
        if promo.get("source") == "promotion_redemption" and promo.get("promotion_redemption_id"):
            await db.promotion_redemptions.update_one(
                {"_id": promo["promotion_redemption_id"]},
                {"$set": {"status": "used", "used_at": datetime.utcnow(), "used_in_order": order_id}}
            )
    
    return {"message": "Promo code applied"}

@router.get("/")
async def get_promo_codes(
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_any_permission(["promo.view"]))
):
    """Get promo codes - requires promo.view permission"""
    db = get_database()
    
    query = {}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    if is_active is not None:
        query["is_active"] = is_active
    
    promos = await db.promo_codes.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.promo_codes.count_documents(query)
    
    return {"promo_codes": promos, "total": total}

@router.put("/{code}")
async def update_promo_code(
    code: str,
    is_active: bool,
    current_user: dict = Depends(require_any_permission(["promo.edit"]))
):
    """Activate/deactivate a promo code - requires promo.edit permission"""
    db = get_database()
    
    query = {"code": code.upper()}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    
    result = await db.promo_codes.update_one(
        query,
        {"$set": {"is_active": is_active, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    return {"message": f"Promo code {'activated' if is_active else 'deactivated'}"}

@router.delete("/{code}")
async def delete_promo_code(
    code: str,
    current_user: dict = Depends(require_any_permission(["promo.delete"]))
):
    """Delete a promo code - requires promo.delete permission"""
    db = get_database()
    
    query = {"code": code.upper()}
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    
    result = await db.promo_codes.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    return {"message": "Promo code deleted"}
