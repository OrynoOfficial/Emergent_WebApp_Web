from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.commission import CommissionConfigCreate, CommissionConfigUpdate
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/commission-config", tags=["Commission"])

@router.post("/")
async def create_commission_config(
    config_data: CommissionConfigCreate,
    current_user: dict = Depends(require_permission("commission.edit"))
):
    """Create a commission configuration - requires commission.edit permission"""
    db = get_database()
    
    config = {
        "_id": str(uuid.uuid4()),
        **config_data.dict(),
        "is_active": True,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.commission_configs.insert_one(config)
    
    return {"message": "Commission config created", "config_id": config["_id"]}

@router.get("/")
async def get_commission_configs(
    service_type: Optional[str] = None,
    operator_id: Optional[str] = None,
    is_active: Optional[bool] = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("commission.view"))
):
    """Get commission configurations - requires commission.view permission"""
    db = get_database()
    
    query = {}
    if service_type:
        query["service_type"] = service_type
    if operator_id:
        query["$or"] = [{"operator_id": operator_id}, {"operator_id": None}]
    if is_active is not None:
        query["is_active"] = is_active
    
    configs = await db.commission_configs.find(query, {"_id": 0}).sort("service_type", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.commission_configs.count_documents(query)
    
    return {"configs": configs, "total": total}

@router.get("/calculate")
async def calculate_commission(
    service_type: str,
    amount: float,
    operator_id: Optional[str] = None
):
    """Calculate commission for a transaction"""
    db = get_database()
    
    # First check for operator-specific config
    config = None
    if operator_id:
        config = await db.commission_configs.find_one({
            "service_type": service_type,
            "operator_id": operator_id,
            "is_active": True
        })
    
    # Fallback to default config
    if not config:
        config = await db.commission_configs.find_one({
            "service_type": service_type,
            "operator_id": None,
            "is_active": True
        })
    
    # Use default rate if no config found
    if not config:
        rate = 5.0  # Default 5%
        commission = amount * (rate / 100)
    else:
        if config["commission_type"] == "percentage":
            commission = amount * (config["base_rate"] / 100)
            # Apply min/max caps
            if config.get("min_amount") and commission < config["min_amount"]:
                commission = config["min_amount"]
            if config.get("max_amount") and commission > config["max_amount"]:
                commission = config["max_amount"]
        else:
            commission = config["base_rate"]  # Fixed amount
        rate = config["base_rate"]
    
    return {
        "amount": amount,
        "commission_rate": rate,
        "commission_amount": round(commission, 2),
        "total_with_commission": round(amount + commission, 2),
        "operator_receives": round(amount - commission, 2) if config and config.get("commission_type") == "percentage" else amount
    }

@router.put("/{config_id}")
async def update_commission_config(
    config_id: str,
    config_data: CommissionConfigUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a commission configuration (admin only)"""
    db = get_database()
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in config_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.commission_configs.update_one({"_id": config_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    
    return {"message": "Commission config updated"}

@router.delete("/{config_id}")
async def delete_commission_config(
    config_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a commission configuration (admin only)"""
    db = get_database()
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.commission_configs.delete_one({"_id": config_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    
    return {"message": "Commission config deleted"}
