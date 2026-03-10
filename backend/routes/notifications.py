from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.notification import NotificationCreate, NotificationType
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.post("/")
async def create_notification(
    notification_data: NotificationCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a notification (admin/system only)"""
    db = get_database()
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    notification = {
        "_id": str(uuid.uuid4()),
        **notification_data.dict(),
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Notification created", "notification_id": notification["_id"]}

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
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
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
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
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
