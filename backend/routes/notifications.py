from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.notification import NotificationCreate, NotificationType, PushDeviceRegister, DevicePlatform
from utils.notifications import (
    create_notification as create_notification_helper,
    dedupe_existing_notifications,
)
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.post("/")
async def create_notification(
    notification_data: NotificationCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a notification (admin/system only). Supports dedupe_key via data.dedupe_key."""
    db = get_database()

    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    payload = notification_data.dict()
    data = payload.get("data") or {}
    dedupe_key = data.pop("dedupe_key", None) if isinstance(data, dict) else None
    nid = await create_notification_helper(
        db,
        user_id=payload["user_id"],
        title=payload["title"],
        message=payload["message"],
        notification_type=payload.get("notification_type", "info"),
        data=data,
        action_url=payload.get("action_url"),
        dedupe_key=dedupe_key,
        channel=payload.get("channel", "in_app"),
    )

    return {"message": "Notification created", "notification_id": nid}

@router.get("/")
async def get_notifications(
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's notifications"""
    db = get_database()
    
    query = {"user_id": current_user["_id"]}
    if is_read is not None:
        query["is_read"] = is_read
    if notification_type:
        query["notification_type"] = notification_type
    
    notifications = await db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Transform _id to id and serialize datetimes
    for n in notifications:
        n["id"] = str(n.pop("_id", ""))
        for dt_field in ["created_at", "read_at"]:
            if n.get(dt_field) and hasattr(n[dt_field], "isoformat"):
                n[dt_field] = n[dt_field].isoformat()
    
    total = await db.notifications.count_documents(query)
    unread = await db.notifications.count_documents({"user_id": current_user["_id"], "is_read": False})
    
    return {"notifications": notifications, "total": total, "unread": unread}

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark notification as read"""
    db = get_database()

    result = await db.notifications.update_one(
        {"_id": notification_id, "user_id": current_user["_id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}

@router.put("/read-all")
async def mark_all_as_read(
    current_user: dict = Depends(get_current_active_user)
):
    """Mark all notifications as read"""
    db = get_database()

    await db.notifications.update_many(
        {"user_id": current_user["_id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
    )

    return {"message": "All notifications marked as read"}

@router.delete("/clear-all")
async def clear_all_notifications(
    current_user: dict = Depends(get_current_active_user)
):
    """Clear all notifications for the current user"""
    db = get_database()
    
    result = await db.notifications.delete_many({
        "user_id": current_user["_id"]
    })
    
    return {"message": "All notifications cleared", "deleted_count": result.deleted_count}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a notification"""
    db = get_database()
    
    result = await db.notifications.delete_one({
        "_id": notification_id,
        "user_id": current_user["_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}


@router.post("/dedupe")
async def dedupe_notifications_admin(
    current_user: dict = Depends(get_current_active_user)
):
    """Admin utility: collapse duplicate notifications in the DB (one-shot)."""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    stats = await dedupe_existing_notifications(db)
    return {"message": "Notifications deduplicated", **stats}

# Support Chat
@router.post("/support")
async def create_support_chat(
    subject: str,
    message: str,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a support chat"""
    db = get_database()
    
    chat = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "user_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip() or "User",
        "user_email": current_user.get("email", ""),
        "subject": subject,
        "status": "open",
        "priority": "normal",
        "category": category,
        "messages": [{
            "sender": "user",
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }],
        "last_message_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.support_chats.insert_one(chat)
    
    return {"message": "Support chat created", "chat_id": chat["_id"]}

@router.get("/support")
async def get_support_chats(
    chat_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's support chats"""
    db = get_database()
    
    query = {}
    
    # Admin sees all, users see their own
    if current_user["role"] != "admin":
        query["user_id"] = current_user["_id"]
    
    if chat_status:
        query["status"] = chat_status
    
    chats = await db.support_chats.find(query, {"_id": 0}).sort("last_message_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.support_chats.count_documents(query)
    
    return {"chats": chats, "total": total}

@router.post("/support/{chat_id}/message")
async def add_support_message(
    chat_id: str,
    message: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a message to support chat"""
    db = get_database()
    
    chat = await db.support_chats.find_one({"_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Users can only message their own chats
    if current_user["role"] != "admin" and chat["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    sender = "admin" if current_user["role"] == "admin" else "user"
    
    new_message = {
        "sender": sender,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await db.support_chats.update_one(
        {"_id": chat_id},
        {
            "$push": {"messages": new_message},
            "$set": {
                "last_message_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "status": "in_progress" if chat["status"] == "open" else chat["status"]
            }
        }
    )
    
    return {"message": "Message added"}

@router.put("/support/{chat_id}/resolve")
async def resolve_support_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Resolve a support chat (admin only)"""
    db = get_database()
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.support_chats.update_one(
        {"_id": chat_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return {"message": "Chat resolved"}


# ─────────────────────────────────────────────────────────────────────────────
# Push-notification device registry
# ─────────────────────────────────────────────────────────────────────────────
# A device row is keyed by `device_id` (stable per-install UUID supplied by the
# mobile client). The token itself (APNs/FCM/Expo) rotates frequently and is
# upserted on every login + cold start. We never trust the token as the
# primary key for that reason.
#
# Why this matters: Apple/Google will silently invalidate stale tokens — if
# we used the token as the PK we'd accumulate dead rows forever and end up
# sending notifications to wrong users when a phone is wiped and re-registered.

@router.post("/register-device", status_code=200)
async def register_push_device(
    payload: PushDeviceRegister,
    current_user: dict = Depends(get_current_active_user),
):
    """Register or refresh a push-notification device for the current user.

    Idempotent: same `device_id` upserts the row (rotates token, bumps
    `last_seen_at`, re-binds to the current user if the device was previously
    logged into a different account on the same phone). Returns the stored
    row so the client can confirm the platform/locale it sent.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    doc_set = {
        "user_id": current_user["_id"],
        "device_token": payload.device_token,
        "platform": payload.platform.value,
        "app_version": payload.app_version,
        "locale": payload.locale,
        "timezone": payload.timezone,
        "is_active": True,
        "updated_at": now,
        "last_seen_at": now,
    }
    doc_set_on_insert = {
        "_id": payload.device_id,
        "created_at": now,
    }

    await db.push_devices.update_one(
        {"_id": payload.device_id},
        {"$set": doc_set, "$setOnInsert": doc_set_on_insert},
        upsert=True,
    )

    stored = await db.push_devices.find_one({"_id": payload.device_id})
    if stored:
        stored["id"] = stored.pop("_id")
    return {"message": "Device registered", "device": stored}


@router.get("/devices")
async def list_my_push_devices(
    current_user: dict = Depends(get_current_active_user),
):
    """List the current user's registered push-notification devices.
    Useful for a 'Logged-in devices' Settings screen on mobile/web."""
    db = get_database()
    cursor = db.push_devices.find({"user_id": current_user["_id"], "is_active": True})
    items = []
    async for d in cursor:
        d["id"] = d.pop("_id")
        d.pop("device_token", None)  # never expose the raw token over the API
        items.append(d)
    return {"devices": items, "total": len(items)}


@router.delete("/devices/{device_id}", status_code=200)
async def unregister_push_device(
    device_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Soft-delete (deactivate) a push device. Called on logout, or from the
    Settings 'Logged-in devices' screen when a user revokes one.
    """
    db = get_database()
    result = await db.push_devices.update_one(
        {"_id": device_id, "user_id": current_user["_id"]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Device unregistered"}
