"""
Generic Service Communications API
Works for all management pages: Hotels, Travel, Restaurants, Car Rental, Events, Cinema, Laundry, Banquet, Packages
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/communications", tags=["Service Communications"])


@router.post("/announcements")
async def create_announcement(
    title: str,
    message: str,
    service_type: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a service announcement"""
    db = get_database()

    announcement = {
        "_id": str(uuid.uuid4()),
        "title": title,
        "message": message,
        "service_type": service_type,
        "created_by": current_user.get("_id"),
        "created_by_name": current_user.get("full_name", current_user.get("email", "")),
        "operator_id": current_user.get("operator_id"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.service_announcements.insert_one(announcement)

    return {"message": "Announcement created", "id": announcement["_id"]}


@router.get("/announcements")
async def get_announcements(
    service_type: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get announcements for a service type"""
    db = get_database()

    query = {"service_type": service_type}
    if current_user.get("role") == "operator":
        query["operator_id"] = current_user.get("operator_id")

    announcements = await db.service_announcements.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for a in announcements:
        a["id"] = str(a.pop("_id", ""))

    return {"announcements": announcements, "total": await db.service_announcements.count_documents(query)}


@router.post("/alerts")
async def create_alert(
    title: str,
    message: str,
    service_type: str,
    severity: str = "medium",
    current_user: dict = Depends(get_current_active_user)
):
    """Create a service alert"""
    db = get_database()

    alert = {
        "_id": str(uuid.uuid4()),
        "title": title,
        "message": message,
        "service_type": service_type,
        "severity": severity,
        "status": "active",
        "created_by": current_user.get("_id"),
        "created_by_name": current_user.get("full_name", current_user.get("email", "")),
        "operator_id": current_user.get("operator_id"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.service_alerts.insert_one(alert)

    return {"message": "Alert created", "id": alert["_id"]}


@router.get("/alerts")
async def get_alerts(
    service_type: str,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get alerts for a service type"""
    db = get_database()

    query = {"service_type": service_type}
    if status:
        query["status"] = status
    if current_user.get("role") == "operator":
        query["operator_id"] = current_user.get("operator_id")

    alerts = await db.service_alerts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for a in alerts:
        a["id"] = str(a.pop("_id", ""))

    return {"alerts": alerts, "total": await db.service_alerts.count_documents(query)}


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Resolve a service alert"""
    db = get_database()

    result = await db.service_alerts.update_one(
        {"_id": alert_id},
        {"$set": {"status": "resolved", "resolved_by": current_user.get("_id"), "resolved_at": datetime.now(timezone.utc)}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {"message": "Alert resolved"}


@router.get("/recent")
async def get_recent_communications(
    service_type: str,
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_active_user)
):
    """Get recent notifications, announcements, and alerts for a service dashboard"""
    db = get_database()

    operator_filter = {}
    if current_user.get("role") == "operator":
        operator_filter = {"operator_id": current_user.get("operator_id")}

    # Recent announcements
    ann_query = {"service_type": service_type, **operator_filter}
    announcements = await db.service_announcements.find(ann_query).sort("created_at", -1).limit(5).to_list(5)
    for a in announcements:
        a["id"] = str(a.pop("_id", ""))
        a["comm_type"] = "announcement"

    # Active alerts
    alert_query = {"service_type": service_type, "status": "active", **operator_filter}
    alerts = await db.service_alerts.find(alert_query).sort("created_at", -1).limit(5).to_list(5)
    for a in alerts:
        a["id"] = str(a.pop("_id", ""))
        a["comm_type"] = "alert"

    # User notifications (service-filtered if possible)
    notif_query = {"user_id": current_user.get("_id")}
    notifications = await db.notifications.find(notif_query).sort("created_at", -1).limit(limit).to_list(limit)
    for n in notifications:
        n["id"] = str(n.pop("_id", ""))
        n["comm_type"] = "notification"

    # Combine and sort by date
    combined = announcements + alerts + notifications
    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {
        "items": combined[:limit],
        "announcements_count": len(announcements),
        "active_alerts_count": len(alerts),
        "unread_notifications": len([n for n in notifications if not n.get("is_read")])
    }
