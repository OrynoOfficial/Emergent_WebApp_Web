"""
Subscriptions API — Users can subscribe/unsubscribe to operators.
Operators can see subscriber counts. Promotions push to subscribed users.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])


class SubscribeRequest(BaseModel):
    operator_id: str
    operator_name: Optional[str] = None


class PromotionCreate(BaseModel):
    title: str
    message: str
    service_type: Optional[str] = None
    promotion_type: Optional[str] = "general"  # general, discount, event, new_service
    discount_value: Optional[str] = None
    valid_until: Optional[str] = None  # ISO date string
    image_url: Optional[str] = None


@router.post("/subscribe")
async def subscribe_to_operator(
    data: SubscribeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Subscribe to an operator to receive promotions/alerts."""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    existing = await db.subscriptions.find_one({
        "user_id": user_id,
        "operator_id": data.operator_id,
    })
    if existing:
        return {"message": "Already subscribed", "subscribed": True}

    # Get operator name if not provided
    operator_name = data.operator_name
    if not operator_name:
        op = await db.operators.find_one({"_id": data.operator_id})
        operator_name = op.get("name", "Unknown") if op else "Unknown"

    sub = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": current_user.get("full_name", ""),
        "user_email": current_user.get("email", ""),
        "operator_id": data.operator_id,
        "operator_name": operator_name,
        "created_at": datetime.now(timezone.utc),
    }
    await db.subscriptions.insert_one(sub)

    # Increment subscriber count on operator
    await db.operators.update_one(
        {"_id": data.operator_id},
        {"$inc": {"subscriber_count": 1}},
    )

    return {"message": "Subscribed successfully", "subscribed": True}


@router.post("/unsubscribe")
async def unsubscribe_from_operator(
    data: SubscribeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Unsubscribe from an operator."""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    result = await db.subscriptions.delete_one({
        "user_id": user_id,
        "operator_id": data.operator_id,
    })

    if result.deleted_count > 0:
        await db.operators.update_one(
            {"_id": data.operator_id},
            {"$inc": {"subscriber_count": -1}},
        )

    return {"message": "Unsubscribed", "subscribed": False}


@router.get("/check")
async def check_subscription(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Check if user is subscribed to an operator."""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    existing = await db.subscriptions.find_one({
        "user_id": user_id,
        "operator_id": operator_id,
    })
    return {"subscribed": existing is not None}


@router.get("/my")
async def get_my_subscriptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """Get current user's subscriptions."""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    subs = await db.subscriptions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.subscriptions.count_documents({"user_id": user_id})

    return {"subscriptions": subs, "total": total}


@router.get("/operator-count")
async def get_operator_subscriber_count(
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """Get subscriber count for operator. Operators see their own; admins can query any."""
    db = get_database()

    op_id = operator_id
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")

    if not op_id:
        return {"count": 0}

    count = await db.subscriptions.count_documents({"operator_id": op_id})
    return {"count": count, "operator_id": op_id}


@router.get("/operator-subscribers")
async def get_operator_subscribers(
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get list of subscribers for an operator."""
    db = get_database()

    op_id = operator_id
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")

    if not op_id:
        return {"subscribers": [], "total": 0}

    subs = await db.subscriptions.find(
        {"operator_id": op_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.subscriptions.count_documents({"operator_id": op_id})

    return {"subscribers": subs, "total": total}


# ---- Promotions / Alerts ----

@router.post("/promotions")
async def create_promotion(
    data: PromotionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Operator creates a promotion/alert that pushes notifications to subscribers."""
    db = get_database()

    # Determine operator_id
    operator_id = current_user.get("operator_id")
    if not operator_id and current_user.get("role") in ("admin", "super_admin"):
        raise HTTPException(400, "Admin must specify operator context")

    if not operator_id:
        raise HTTPException(403, "Only operators can create promotions")

    # Get operator name
    op = await db.operators.find_one({"_id": operator_id})
    operator_name = op.get("name", "Unknown") if op else "Unknown"

    # Create promotion record
    promo_id = str(uuid.uuid4())
    valid_until = None
    if data.valid_until:
        try:
            valid_until = datetime.fromisoformat(data.valid_until.replace("Z", "+00:00"))
        except ValueError:
            valid_until = None

    promotion = {
        "_id": promo_id,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "title": data.title,
        "message": data.message,
        "service_type": data.service_type,
        "promotion_type": data.promotion_type,
        "discount_value": data.discount_value,
        "valid_until": valid_until,
        "image_url": data.image_url,
        "created_by": current_user.get("_id") or current_user.get("id"),
        "created_by_name": current_user.get("full_name", ""),
        "created_at": datetime.now(timezone.utc),
        "status": "active",
    }
    await db.promotions.insert_one(promotion)

    # Push notifications to all subscribers
    subscribers = await db.subscriptions.find(
        {"operator_id": operator_id}
    ).to_list(10000)

    notifications = []
    for sub in subscribers:
        notifications.append({
            "_id": str(uuid.uuid4()),
            "user_id": sub["user_id"],
            "title": f"New from {operator_name}: {data.title}",
            "message": data.message,
            "type": "promotion",
            "source": "operator_promotion",
            "promotion_id": promo_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })

    if notifications:
        await db.notifications.insert_many(notifications)

    return {
        "message": f"Promotion created and sent to {len(subscribers)} subscribers",
        "promotion_id": promo_id,
        "notified_count": len(subscribers),
    }


@router.get("/promotions")
async def get_promotions(
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get promotions created by operator."""
    db = get_database()

    op_id = operator_id
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")

    query = {}
    if op_id:
        query["operator_id"] = op_id

    promos = await db.promotions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for p in promos:
        p["id"] = str(p.pop("_id", ""))

    total = await db.promotions.count_documents(query)
    return {"promotions": promos, "total": total}


@router.delete("/promotions/{promotion_id}")
async def delete_promotion(
    promotion_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a promotion."""
    db = get_database()
    result = await db.promotions.delete_one({"_id": promotion_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Promotion not found")
    return {"message": "Promotion deleted"}
