from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.loyalty import LoyaltyTier
from typing import Optional
from datetime import datetime, timedelta
import uuid
import secrets
import string

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty"])

# Points earned per currency unit spent
POINTS_PER_CURRENCY = 0.1  # 10 points per 100 XAF

# Tier thresholds (total points earned)
TIER_THRESHOLDS = {
    LoyaltyTier.BRONZE: 0,
    LoyaltyTier.SILVER: 1000,
    LoyaltyTier.GOLD: 5000,
    LoyaltyTier.PLATINUM: 15000
}

# Tier benefits (bonus multiplier)
TIER_MULTIPLIERS = {
    LoyaltyTier.BRONZE: 1.0,
    LoyaltyTier.SILVER: 1.25,
    LoyaltyTier.GOLD: 1.5,
    LoyaltyTier.PLATINUM: 2.0
}

@router.get("/program")
async def get_loyalty_program(
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's loyalty program details"""
    db = get_database()
    
    program = await db.loyalty_programs.find_one({"user_id": current_user["_id"]}, {"_id": 0})
    
    if not program:
        # Create new loyalty program for user
        program = {
            "_id": str(uuid.uuid4()),
            "user_id": current_user["_id"],
            "total_points": 0,
            "available_points": 0,
            "tier": LoyaltyTier.BRONZE,
            "total_spent": 0,
            "total_bookings": 0,
            "joined_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.loyalty_programs.insert_one(program)
        program.pop("_id")
    
    # Auto-recalculate tier based on total_points
    correct_tier = LoyaltyTier.BRONZE
    for tier_name, threshold in TIER_THRESHOLDS.items():
        if program["total_points"] >= threshold:
            correct_tier = tier_name
    if program["tier"] != correct_tier:
        program["tier"] = correct_tier
        await db.loyalty_programs.update_one(
            {"user_id": current_user["_id"]},
            {"$set": {"tier": correct_tier, "updated_at": datetime.utcnow()}}
        )
    
    # Add tier info
    program["tier_multiplier"] = TIER_MULTIPLIERS.get(program["tier"], 1.0)
    program["next_tier"] = None
    program["points_to_next_tier"] = None
    
    # Calculate next tier
    tiers = list(TIER_THRESHOLDS.keys())
    current_idx = tiers.index(program["tier"]) if program["tier"] in tiers else 0
    if current_idx < len(tiers) - 1:
        next_tier = tiers[current_idx + 1]
        program["next_tier"] = next_tier
        program["points_to_next_tier"] = TIER_THRESHOLDS[next_tier] - program["total_points"]
    
    return program

@router.post("/earn")
async def earn_points(
    amount: float,
    order_id: str,
    service_type: str,
    description: str = "Purchase reward",
    current_user: dict = Depends(get_current_active_user)
):
    """Earn loyalty points from a purchase"""
    db = get_database()
    
    # Get or create loyalty program
    program = await db.loyalty_programs.find_one({"user_id": current_user["_id"]})
    
    if not program:
        program = {
            "_id": str(uuid.uuid4()),
            "user_id": current_user["_id"],
            "total_points": 0,
            "available_points": 0,
            "tier": LoyaltyTier.BRONZE,
            "total_spent": 0,
            "total_bookings": 0,
            "joined_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.loyalty_programs.insert_one(program)
    
    # Calculate points with tier multiplier
    multiplier = TIER_MULTIPLIERS.get(program["tier"], 1.0)
    base_points = int(amount * POINTS_PER_CURRENCY)
    bonus_points = int(base_points * (multiplier - 1))
    total_earned = base_points + bonus_points
    
    # Create transaction
    transaction = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "loyalty_program_id": program["_id"],
        "transaction_type": "earn",
        "points": total_earned,
        "description": f"{description} (+{bonus_points} bonus)" if bonus_points > 0 else description,
        "order_id": order_id,
        "service_type": service_type,
        "expires_at": datetime.utcnow() + timedelta(days=365),  # Points expire after 1 year
        "created_at": datetime.utcnow()
    }
    await db.loyalty_transactions.insert_one(transaction)
    
    # Update program
    new_total = program["total_points"] + total_earned
    new_available = program["available_points"] + total_earned
    new_spent = program["total_spent"] + amount
    new_bookings = program["total_bookings"] + 1
    
    # Check for tier upgrade
    new_tier = program["tier"]
    for tier, threshold in reversed(list(TIER_THRESHOLDS.items())):
        if new_total >= threshold:
            new_tier = tier
            break
    
    update_data = {
        "total_points": new_total,
        "available_points": new_available,
        "total_spent": new_spent,
        "total_bookings": new_bookings,
        "tier": new_tier,
        "updated_at": datetime.utcnow()
    }
    
    if new_tier != program["tier"]:
        update_data["tier_updated_at"] = datetime.utcnow()
    
    await db.loyalty_programs.update_one({"_id": program["_id"]}, {"$set": update_data})
    
    return {
        "points_earned": total_earned,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "new_total": new_total,
        "new_tier": new_tier,
        "tier_upgraded": new_tier != program["tier"]
    }

@router.get("/transactions")
async def get_transactions(
    transaction_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get loyalty transactions"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    transactions = await db.loyalty_transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.loyalty_transactions.count_documents(query)
    
    return {"transactions": transactions, "total": total}

@router.get("/rewards")
async def get_available_rewards(
    current_user: dict = Depends(get_current_active_user)
):
    """Get available rewards for redemption"""
    db = get_database()
    
    program = await db.loyalty_programs.find_one({"user_id": current_user["_id"]})
    user_tier = program["tier"] if program else LoyaltyTier.BRONZE
    
    # Get rewards available for user's tier
    tier_order = [LoyaltyTier.BRONZE, LoyaltyTier.SILVER, LoyaltyTier.GOLD, LoyaltyTier.PLATINUM]
    user_tier_idx = tier_order.index(user_tier)
    available_tiers = tier_order[:user_tier_idx + 1]
    
    rewards = await db.loyalty_rewards.find({
        "is_active": True,
        "min_tier": {"$in": available_tiers}
    }).to_list(100)
    
    # Convert _id to id
    for r in rewards:
        r["id"] = str(r.pop("_id", ""))
    
    return {
        "rewards": rewards,
        "user_points": program["available_points"] if program else 0,
        "user_tier": user_tier
    }

@router.post("/redeem/{reward_id}")
async def redeem_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Redeem a reward"""
    db = get_database()
    
    # Get reward - support both _id and id fields
    reward = await db.loyalty_rewards.find_one({"_id": reward_id, "is_active": True})
    if not reward:
        reward = await db.loyalty_rewards.find_one({"id": reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Get user's program
    program = await db.loyalty_programs.find_one({"user_id": current_user["_id"]})
    if not program:
        raise HTTPException(status_code=400, detail="No loyalty program found")
    
    # Check points
    if program["available_points"] < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Check tier
    tier_order = [LoyaltyTier.BRONZE, LoyaltyTier.SILVER, LoyaltyTier.GOLD, LoyaltyTier.PLATINUM]
    if tier_order.index(program["tier"]) < tier_order.index(reward["min_tier"]):
        raise HTTPException(status_code=400, detail="Tier requirement not met")
    
    # Generate redemption code
    code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(10))
    
    # Create redemption
    redemption = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "loyalty_program_id": program["_id"],
        "reward_id": reward_id,
        "reward_name": reward.get("name") or reward.get("title", "Reward"),
        "points_used": reward["points_required"],
        "status": "pending",
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(days=30),
        "created_at": datetime.utcnow()
    }
    await db.loyalty_redemptions.insert_one(redemption)
    
    # Deduct points
    await db.loyalty_programs.update_one(
        {"_id": program["_id"]},
        {"$inc": {"available_points": -reward["points_required"]}}
    )
    
    # Create transaction
    transaction = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "loyalty_program_id": program["_id"],
        "transaction_type": "redeem",
        "points": -reward["points_required"],
        "description": f"Redeemed: {reward['name']}",
        "created_at": datetime.utcnow()
    }
    await db.loyalty_transactions.insert_one(transaction)
    
    return {
        "message": "Reward redeemed",
        "redemption_code": code,
        "expires_at": redemption["expires_at"].isoformat(),
        "points_used": reward["points_required"]
    }

@router.get("/redemptions")
async def get_redemptions(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's redemptions"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    redemptions = await db.loyalty_redemptions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.loyalty_redemptions.count_documents(query)
    
    return {"redemptions": redemptions, "total": total}


# ==================== ADMIN ENDPOINTS ====================

from pydantic import BaseModel
from typing import List

class RewardCreate(BaseModel):
    title: str
    description: str
    points_required: int
    min_tier: str = "bronze"
    type: str = "discount"
    discount_value: Optional[float] = None
    service_types: List[str] = []
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    max_redemptions: Optional[int] = None
    total_available: Optional[int] = None

class RewardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    points_required: Optional[int] = None
    min_tier: Optional[str] = None
    type: Optional[str] = None
    discount_value: Optional[float] = None
    is_active: Optional[bool] = None
    service_types: Optional[List[str]] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    max_redemptions: Optional[int] = None
    total_available: Optional[int] = None


@router.get("/admin/stats")
async def get_admin_loyalty_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get loyalty program statistics for admin dashboard"""
    # Check if user is admin
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get total members
    total_members = await db.loyalty_programs.count_documents({})
    
    # Get total points issued and redeemed
    pipeline = [
        {"$group": {
            "_id": "$transaction_type",
            "total": {"$sum": {"$abs": "$points"}}
        }}
    ]
    transactions = await db.loyalty_transactions.aggregate(pipeline).to_list(10)
    
    total_points_issued = 0
    total_points_redeemed = 0
    for t in transactions:
        if t["_id"] == "earn":
            total_points_issued = t["total"]
        elif t["_id"] == "redeem":
            total_points_redeemed = t["total"]
    
    # Get members by tier
    tier_pipeline = [
        {"$group": {"_id": "$tier", "count": {"$sum": 1}}}
    ]
    tier_counts = await db.loyalty_programs.aggregate(tier_pipeline).to_list(10)
    members_by_tier = {t["_id"]: t["count"] for t in tier_counts}
    
    # Get active rewards count
    active_rewards = await db.loyalty_rewards.count_documents({"is_active": True})
    
    return {
        "totalMembers": total_members,
        "totalPointsIssued": total_points_issued,
        "totalPointsRedeemed": total_points_redeemed,
        "activeRewards": active_rewards,
        "membersByTier": {
            "bronze": members_by_tier.get("bronze", 0),
            "silver": members_by_tier.get("silver", 0),
            "gold": members_by_tier.get("gold", 0),
            "platinum": members_by_tier.get("platinum", 0)
        }
    }


@router.get("/admin/members")
async def get_admin_loyalty_members(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user)
):
    """Get all loyalty program members for admin"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Build query
    query = {}
    if tier:
        query["tier"] = tier
    
    # Get loyalty programs
    programs = await db.loyalty_programs.find(query).sort("total_points", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    members = []
    for prog in programs:
        user = await db.users.find_one({"_id": prog["user_id"]}, {"password_hash": 0})
        if user:
            # Apply search filter
            if search:
                search_lower = search.lower()
                if not (search_lower in user.get("full_name", "").lower() or 
                        search_lower in user.get("email", "").lower()):
                    continue
            
            members.append({
                "id": prog.get("user_id"),  # Use user_id for member detail endpoint compatibility
                "name": user.get("full_name", "Unknown"),
                "email": user.get("email", ""),
                "tier": prog.get("tier", "bronze"),
                "total_points": prog.get("total_points", 0),
                "available_points": prog.get("available_points", 0),
                "total_spent": prog.get("total_spent", 0),
                "joined_at": prog.get("joined_at")
            })
    
    total = await db.loyalty_programs.count_documents(query)
    
    return {"members": members, "total": total}


@router.get("/admin/rewards")
async def get_admin_rewards(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all rewards for admin management"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    rewards = await db.loyalty_rewards.find({}).to_list(100)
    
    # Convert _id to id
    result = []
    for r in rewards:
        r["id"] = str(r.pop("_id", ""))
        result.append(r)
    
    return {"rewards": result}


@router.post("/admin/rewards")
async def create_reward(
    reward_data: RewardCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new reward"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    reward = {
        "_id": str(uuid.uuid4()),
        "title": reward_data.title,
        "name": reward_data.title,
        "description": reward_data.description,
        "points_required": reward_data.points_required,
        "min_tier": reward_data.min_tier,
        "type": reward_data.type,
        "discount_value": reward_data.discount_value,
        "service_types": reward_data.service_types,
        "valid_from": reward_data.valid_from,
        "valid_to": reward_data.valid_to,
        "max_redemptions": reward_data.max_redemptions,
        "total_available": reward_data.total_available,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.loyalty_rewards.insert_one(reward)
    
    reward["id"] = reward.pop("_id")
    return {"message": "Reward created successfully", "reward": reward}


@router.put("/admin/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    reward_data: RewardUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an existing reward"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Check if reward exists
    existing = await db.loyalty_rewards.find_one({"_id": reward_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Build update dict
    update_dict = {"updated_at": datetime.utcnow()}
    if reward_data.title is not None:
        update_dict["title"] = reward_data.title
        update_dict["name"] = reward_data.title
    if reward_data.description is not None:
        update_dict["description"] = reward_data.description
    if reward_data.points_required is not None:
        update_dict["points_required"] = reward_data.points_required
    if reward_data.min_tier is not None:
        update_dict["min_tier"] = reward_data.min_tier
    if reward_data.type is not None:
        update_dict["type"] = reward_data.type
    if reward_data.discount_value is not None:
        update_dict["discount_value"] = reward_data.discount_value
    if reward_data.is_active is not None:
        update_dict["is_active"] = reward_data.is_active
    if reward_data.service_types is not None:
        update_dict["service_types"] = reward_data.service_types
    if reward_data.valid_from is not None:
        update_dict["valid_from"] = reward_data.valid_from
    if reward_data.valid_to is not None:
        update_dict["valid_to"] = reward_data.valid_to
    if reward_data.max_redemptions is not None:
        update_dict["max_redemptions"] = reward_data.max_redemptions
    if reward_data.total_available is not None:
        update_dict["total_available"] = reward_data.total_available
    
    await db.loyalty_rewards.update_one({"_id": reward_id}, {"$set": update_dict})
    
    return {"message": "Reward updated successfully"}


@router.delete("/admin/rewards/{reward_id}")
async def delete_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a reward"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    result = await db.loyalty_rewards.delete_one({"_id": reward_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward deleted successfully"}


@router.get("/admin/members/{user_id}")
async def get_member_detail(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed loyalty info for a specific member"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get loyalty program
    program = await db.loyalty_programs.find_one({"user_id": user_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty program not found for this user")
    
    # Get user info
    user = await db.users.find_one({"_id": user_id}, {"password_hash": 0, "_id": 0})
    
    # Get point transactions
    transactions = await db.loyalty_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Get redemptions
    redemptions = await db.loyalty_redemptions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "user": user,
        "program": program,
        "transactions": transactions,
        "redemptions": redemptions
    }


@router.get("/admin/stats/tier-history")
async def get_tier_distribution_history(
    current_user: dict = Depends(get_current_active_user)
):
    """Get tier distribution over time for charts"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Current tier distribution
    pipeline = [
        {"$group": {"_id": "$tier", "count": {"$sum": 1}, "total_points": {"$sum": "$total_points"}, "total_spent": {"$sum": "$total_spent"}}}
    ]
    tier_data = await db.loyalty_programs.aggregate(pipeline).to_list(10)
    
    tiers = {}
    for t in tier_data:
        tiers[t["_id"] or "bronze"] = {
            "count": t["count"],
            "total_points": t["total_points"],
            "total_spent": t["total_spent"]
        }
    
    # Recent transactions summary (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    tx_pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$transaction_type", "total": {"$sum": {"$abs": "$points"}}, "count": {"$sum": 1}}}
    ]
    tx_summary = await db.loyalty_transactions.aggregate(tx_pipeline).to_list(10)
    
    recent_activity = {}
    for tx in tx_summary:
        recent_activity[tx["_id"] or "other"] = {"total_points": tx["total"], "count": tx["count"]}
    
    # Total redemptions
    total_redemptions = await db.loyalty_redemptions.count_documents({})
    
    return {
        "tier_distribution": tiers,
        "recent_activity": recent_activity,
        "total_redemptions": total_redemptions
    }



# ============== Referral System ==============

@router.get("/referral")
async def get_referral_info(
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's referral code and stats"""
    db = get_database()
    user_id = current_user["_id"]
    
    # Find or create referral record
    referral = await db.referrals.find_one({"user_id": user_id}, {"_id": 0})
    
    if not referral:
        # Generate unique referral code
        code = "ORYNO" + user_id[-6:].upper()
        # Ensure uniqueness
        existing = await db.referrals.find_one({"code": code})
        if existing:
            code = "ORYNO" + secrets.token_hex(3).upper()
        
        referral = {
            "user_id": user_id,
            "code": code,
            "total_referrals": 0,
            "successful_referrals": 0,
            "points_earned": 0,
            "created_at": datetime.utcnow().isoformat()
        }
        await db.referrals.insert_one({**referral, "_id": str(uuid.uuid4())})
    
    # Get referral history
    history = await db.referral_claims.find(
        {"referrer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "code": referral["code"],
        "total_referrals": referral.get("total_referrals", 0),
        "successful_referrals": referral.get("successful_referrals", 0),
        "points_earned": referral.get("points_earned", 0),
        "history": history
    }


@router.post("/referral/claim")
async def claim_referral(
    referral_code: str = Query(..., description="Referral code to claim"),
    current_user: dict = Depends(get_current_active_user)
):
    """Claim a referral code (new user uses someone's referral)"""
    db = get_database()
    user_id = current_user["_id"]
    
    # Can't refer yourself
    own_referral = await db.referrals.find_one({"user_id": user_id, "code": referral_code.upper()})
    if own_referral:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")
    
    # Check if user already claimed a referral
    existing_claim = await db.referral_claims.find_one({"claimer_id": user_id})
    if existing_claim:
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    # Find the referrer
    referral = await db.referrals.find_one({"code": referral_code.upper()})
    if not referral:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    referrer_id = referral["user_id"]
    REFERRAL_POINTS = 10
    
    # Create claim record
    claim = {
        "_id": str(uuid.uuid4()),
        "referrer_id": referrer_id,
        "claimer_id": user_id,
        "claimer_email": current_user.get("email", ""),
        "claimer_name": current_user.get("full_name", ""),
        "code": referral_code.upper(),
        "points_awarded": REFERRAL_POINTS,
        "status": "completed",
        "created_at": datetime.utcnow().isoformat()
    }
    await db.referral_claims.insert_one(claim)
    
    # Award points to referrer
    await db.referrals.update_one(
        {"user_id": referrer_id},
        {"$inc": {"total_referrals": 1, "successful_referrals": 1, "points_earned": REFERRAL_POINTS}}
    )
    
    # Add points to referrer's loyalty program
    referrer_program = await db.loyalty_programs.find_one({"user_id": referrer_id})
    if referrer_program:
        await db.loyalty_programs.update_one(
            {"user_id": referrer_id},
            {"$inc": {"total_points": REFERRAL_POINTS, "available_points": REFERRAL_POINTS}}
        )
        # Log transaction
        await db.loyalty_transactions.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": referrer_id,
            "transaction_type": "earn",
            "points": REFERRAL_POINTS,
            "description": f"Referral bonus from {current_user.get('full_name', 'a friend')}",
            "created_at": datetime.utcnow()
        })
    
    return {"message": f"Referral code applied! {referral.get('user_id', 'Your friend')} earned {REFERRAL_POINTS} points.", "points_awarded_to_referrer": REFERRAL_POINTS}

