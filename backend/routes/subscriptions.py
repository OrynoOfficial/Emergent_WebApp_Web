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


class AlertCreate(BaseModel):
    title: str
    message: str
    target_type: str = "subscribers"  # subscribers, specific_user
    target_user_id: Optional[str] = None
    target_user_name: Optional[str] = None
    service_type: Optional[str] = None
    related_order_id: Optional[str] = None


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


# ---- Alerts (immediate, on-demand) ----

@router.post("/alerts")
async def create_alert(
    data: AlertCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Operator sends an on-demand alert to subscribers or a specific user."""
    db = get_database()

    operator_id = current_user.get("operator_id")
    if not operator_id:
        raise HTTPException(400, "No operator linked to your account")

    op = await db.operators.find_one({"_id": operator_id})
    operator_name = op.get("name", "Unknown") if op else "Unknown"

    alert_id = str(uuid.uuid4())
    alert = {
        "_id": alert_id,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "title": data.title,
        "message": data.message,
        "target_type": data.target_type,
        "target_user_id": data.target_user_id,
        "target_user_name": data.target_user_name,
        "service_type": data.service_type,
        "related_order_id": data.related_order_id,
        "created_by": current_user.get("_id") or current_user.get("id"),
        "created_by_name": current_user.get("full_name", ""),
        "created_at": datetime.now(timezone.utc),
        "type": "alert",
    }
    await db.promotions.insert_one(alert)

    # Send notifications immediately
    notifications = []
    if data.target_type == "specific_user" and data.target_user_id:
        notifications.append({
            "_id": str(uuid.uuid4()),
            "user_id": data.target_user_id,
            "title": f"Alert from {operator_name}: {data.title}",
            "message": data.message,
            "type": "operator_alert",
            "source": "operator_alert",
            "operator_id": operator_id,
            "operator_name": operator_name,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        subscribers = await db.subscriptions.find({"operator_id": operator_id}).to_list(10000)
        for sub in subscribers:
            notifications.append({
                "_id": str(uuid.uuid4()),
                "user_id": sub["user_id"],
                "title": f"Alert from {operator_name}: {data.title}",
                "message": data.message,
                "type": "operator_alert",
                "source": "operator_alert",
                "operator_id": operator_id,
                "operator_name": operator_name,
                "is_read": False,
                "created_at": datetime.now(timezone.utc),
            })

    if notifications:
        await db.notifications.insert_many(notifications)

    return {
        "message": f"Alert sent to {len(notifications)} user(s)",
        "alert_id": alert_id,
        "notified_count": len(notifications),
    }


# ---- Promotions (require approval) ----

@router.post("/promotions")
async def create_promotion(
    data: PromotionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Operator creates a promotion that requires admin approval before sending."""
    db = get_database()

    operator_id = current_user.get("operator_id")
    if not operator_id:
        raise HTTPException(400, "No operator linked to your account")

    op = await db.operators.find_one({"_id": operator_id})
    operator_name = op.get("name", "Unknown") if op else "Unknown"

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
        "status": "pending_approval",
        "type": "promotion",
    }
    await db.promotions.insert_one(promotion)

    return {
        "message": "Promotion submitted for approval",
        "promotion_id": promo_id,
        "status": "pending_approval",
    }


@router.put("/promotions/{promotion_id}/approve")
async def approve_promotion(
    promotion_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Admin/Super Admin approves a promotion and sends notifications to subscribers."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Only admins can approve promotions")

    db = get_database()

    promo = await db.promotions.find_one({"_id": promotion_id})
    if not promo:
        raise HTTPException(404, "Promotion not found")
    if promo.get("status") != "pending_approval":
        raise HTTPException(400, f"Promotion is already {promo.get('status')}")

    await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.get("_id"),
            "approved_by_name": current_user.get("full_name", ""),
            "approved_at": datetime.now(timezone.utc),
        }}
    )

    # Send notifications to subscribers
    operator_id = promo.get("operator_id")
    operator_name = promo.get("operator_name", "Operator")
    subscribers = await db.subscriptions.find({"operator_id": operator_id}).to_list(10000)

    notifications = []
    for sub in subscribers:
        notifications.append({
            "_id": str(uuid.uuid4()),
            "user_id": sub["user_id"],
            "title": f"New from {operator_name}: {promo['title']}",
            "message": promo.get("message", ""),
            "type": "promotion",
            "source": "operator_promotion",
            "promotion_id": promotion_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })

    if notifications:
        await db.notifications.insert_many(notifications)

    return {
        "message": f"Promotion approved and sent to {len(subscribers)} subscribers",
        "notified_count": len(subscribers),
    }


@router.put("/promotions/{promotion_id}/reject")
async def reject_promotion(
    promotion_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """Admin/Super Admin rejects a promotion."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Only admins can reject promotions")

    db = get_database()
    result = await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user.get("_id"),
            "rejected_by_name": current_user.get("full_name", ""),
            "rejected_at": datetime.now(timezone.utc),
            "rejection_reason": reason,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Promotion not found")

    return {"message": "Promotion rejected"}


@router.get("/promotions")
async def get_promotions(
    operator_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Get promotions and alerts. Operators see their own; admins see all."""
    db = get_database()

    op_id = operator_id
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")

    query = {}
    if op_id:
        query["operator_id"] = op_id
    if status:
        query["status"] = status

    promos = await db.promotions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for p in promos:
        p["id"] = str(p.pop("_id", ""))

    total = await db.promotions.count_documents(query)

    # Count pending approvals (for admins)
    pending_count = await db.promotions.count_documents({"status": "pending_approval"})

    return {"promotions": promos, "total": total, "pending_approval_count": pending_count}


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
