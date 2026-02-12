from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from uuid import uuid4
from bson import ObjectId

router = APIRouter(prefix="/api/activity", tags=["Activity Log"])

class ActivityLogEntry(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    details: Optional[str] = None
    metadata: Optional[dict] = None

class ActivityLogResponse(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: Optional[str]
    entity_name: Optional[str]
    details: Optional[str]
    actor_id: str
    actor_name: str
    actor_email: str
    actor_role: str
    severity: str
    timestamp: str
    ip_address: Optional[str]
    metadata: Optional[dict]

# Activity actions categorized by type
ACTION_CATEGORIES = {
    # User actions
    "user.login": {"severity": "info", "description": "User logged in"},
    "user.logout": {"severity": "info", "description": "User logged out"},
    "user.create": {"severity": "info", "description": "New user created"},
    "user.update": {"severity": "info", "description": "User profile updated"},
    "user.delete": {"severity": "warning", "description": "User deleted"},
    "user.password_change": {"severity": "info", "description": "Password changed"},
    "user.role_change": {"severity": "warning", "description": "User role modified"},
    
    # Order actions
    "order.create": {"severity": "info", "description": "New order created"},
    "order.update": {"severity": "info", "description": "Order updated"},
    "order.approve": {"severity": "info", "description": "Order approved"},
    "order.reject": {"severity": "warning", "description": "Order rejected"},
    "order.cancel": {"severity": "warning", "description": "Order cancelled"},
    "order.complete": {"severity": "info", "description": "Order completed"},
    
    # Payment actions
    "payment.initiate": {"severity": "info", "description": "Payment initiated"},
    "payment.success": {"severity": "info", "description": "Payment successful"},
    "payment.fail": {"severity": "error", "description": "Payment failed"},
    "payment.refund": {"severity": "warning", "description": "Refund processed"},
    "payment.verify": {"severity": "info", "description": "Payment verified manually"},
    
    # Service actions
    "service.create": {"severity": "info", "description": "Service created"},
    "service.update": {"severity": "info", "description": "Service updated"},
    "service.delete": {"severity": "warning", "description": "Service deleted"},
    "service.approve": {"severity": "info", "description": "Service approved"},
    "service.reject": {"severity": "warning", "description": "Service rejected"},
    "service.suspend": {"severity": "warning", "description": "Service suspended"},
    
    # Settings actions
    "settings.update": {"severity": "info", "description": "Settings updated"},
    "settings.commission_change": {"severity": "warning", "description": "Commission settings changed"},
    
    # Security actions
    "security.login_fail": {"severity": "warning", "description": "Failed login attempt"},
    "security.suspicious_activity": {"severity": "error", "description": "Suspicious activity detected"},
    "security.permission_denied": {"severity": "warning", "description": "Permission denied"},
    
    # Validation actions
    "validation.ticket_approve": {"severity": "info", "description": "Ticket approved"},
    "validation.ticket_reject": {"severity": "warning", "description": "Ticket rejected"},
    "validation.service_approve": {"severity": "info", "description": "Service submission approved"},
    "validation.service_reject": {"severity": "warning", "description": "Service submission rejected"},
}

def get_action_severity(action: str) -> str:
    """Get severity level for an action"""
    if action in ACTION_CATEGORIES:
        return ACTION_CATEGORIES[action]["severity"]
    # Default severity based on action keywords
    if "fail" in action or "error" in action or "suspicious" in action:
        return "error"
    if "reject" in action or "cancel" in action or "delete" in action or "suspend" in action:
        return "warning"
    return "info"

@router.post("/log")
async def log_activity(
    entry: ActivityLogEntry,
    current_user: dict = Depends(get_current_active_user)
):
    """Log a user activity"""
    db = get_database()
    
    log_entry = {
        "id": str(uuid4()),
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "entity_name": entry.entity_name,
        "details": entry.details,
        "actor_id": current_user.get("id"),
        "actor_name": current_user.get("full_name", current_user.get("email")),
        "actor_email": current_user.get("email"),
        "actor_role": current_user.get("role"),
        "severity": get_action_severity(entry.action),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": entry.metadata or {}
    }
    
    await db.activity_logs.insert_one(log_entry)
    
    return {"message": "Activity logged", "log_id": log_entry["id"]}

@router.get("/logs")
async def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get activity logs with filtering and pagination - role-based access"""
    db = get_database()
    
    # Get user role and permissions
    user_role = current_user.get("role")
    is_super_admin = user_role == "super_admin"
    is_admin = user_role == "admin"
    is_operator = user_role == "operator"
    
    # Build query filter
    query = {}
    
    # Role-based filtering
    if is_super_admin:
        # Super Admin: Unrestricted view of all audit logs
        pass
    elif is_admin:
        # Admin: Can view own logs + all operator logs (hide super_admin and customer logs)
        query["$or"] = [
            {"actor_id": current_user.get("id")},
            {"actor_role": {"$in": ["operator"]}}
        ]
    elif is_operator:
        # Operator: View own logs + team logs if owner/has permission
        operator_id = current_user.get("operator_id")
        user_id = current_user.get("_id") or current_user.get("id")  # Handle both formats
        
        # Check if user is owner or has team audit view permission
        is_owner = False
        can_view_team_logs = False
        
        if operator_id:
            try:
                # Check if user is owner
                op_obj_id = ObjectId(operator_id) if not isinstance(operator_id, ObjectId) else operator_id
                operator_data = await db.operators.find_one({"_id": op_obj_id}, {"owner_user_id": 1})
                if operator_data and str(operator_data.get("owner_user_id")) == str(user_id):
                    is_owner = True
                
                # Check for team audit view permission (local permission)
                user_obj_id = ObjectId(user_id) if not isinstance(user_id, ObjectId) else user_id
                user_data = await db.users.find_one({"_id": user_obj_id}, {"local_permissions": 1})
                local_perms = user_data.get("local_permissions", []) if user_data else []
                can_view_team_logs = "team_audit.view" in local_perms
            except Exception as e:
                print(f"Error checking operator permissions: {e}")
                pass
        
        if is_owner or can_view_team_logs:
            # Can view team logs - get all team member IDs
            team_members = await db.users.find(
                {"operator_id": operator_id}, 
                {"_id": 1}
            ).to_list(100)
            team_ids = [str(m["_id"]) for m in team_members]
            query["actor_id"] = {"$in": team_ids}
        else:
            # Only own logs
            query["actor_id"] = str(user_id)
    else:
        # Regular users: Only see own logs
        query["actor_id"] = current_user.get("id")
    
    # Apply additional filters
    if action_type:
        query["action"] = {"$regex": f"^{action_type}", "$options": "i"}
    
    if entity_type:
        query["entity_type"] = entity_type
    
    if actor_id and (is_super_admin or is_admin):
        query["actor_id"] = actor_id
    
    if severity:
        query["severity"] = severity
    
    if search:
        search_query = [
            {"action": {"$regex": search, "$options": "i"}},
            {"details": {"$regex": search, "$options": "i"}},
            {"entity_name": {"$regex": search, "$options": "i"}},
            {"actor_name": {"$regex": search, "$options": "i"}},
            {"actor_email": {"$regex": search, "$options": "i"}}
        ]
        if "$or" in query:
            # Combine with existing $or
            query = {"$and": [{"$or": query["$or"]}, {"$or": search_query}]}
        else:
            query["$or"] = search_query
    
    if date_from:
        query["timestamp"] = {"$gte": date_from}
    
    if date_to:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = date_to
        else:
            query["timestamp"] = {"$lte": date_to}
    
    # Get total count
    total = await db.activity_logs.count_documents(query)
    
    # Get paginated logs
    skip = (page - 1) * limit
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "has_more": skip + len(logs) < total
    }

@router.get("/stats")
async def get_activity_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get activity statistics for dashboard"""
    user_role = current_user.get("role")
    if user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get counts by severity
    pipeline = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]
    severity_counts = await db.activity_logs.aggregate(pipeline).to_list(10)
    
    # Get counts by action type (first part before .)
    pipeline = [
        {"$project": {"action_type": {"$arrayElemAt": [{"$split": ["$action", "."]}, 0]}}},
        {"$group": {"_id": "$action_type", "count": {"$sum": 1}}}
    ]
    action_counts = await db.activity_logs.aggregate(pipeline).to_list(20)
    
    # Get recent activity count (last 24 hours)
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_count = await db.activity_logs.count_documents({"timestamp": {"$gte": yesterday}})
    
    # Get most active users
    pipeline = [
        {"$group": {"_id": {"id": "$actor_id", "name": "$actor_name", "email": "$actor_email"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    active_users = await db.activity_logs.aggregate(pipeline).to_list(10)
    
    return {
        "severity_breakdown": {item["_id"]: item["count"] for item in severity_counts if item["_id"]},
        "action_breakdown": {item["_id"]: item["count"] for item in action_counts if item["_id"]},
        "recent_24h": recent_count,
        "most_active_users": [
            {"actor_id": item["_id"]["id"], "actor_name": item["_id"]["name"], "actor_email": item["_id"]["email"], "count": item["count"]}
            for item in active_users if item["_id"]
        ],
        "total_logs": await db.activity_logs.count_documents({})
    }

@router.get("/actions")
async def get_action_types(
    current_user: dict = Depends(get_current_active_user)
):
    """Get available action types for filtering"""
    return {
        "action_categories": ACTION_CATEGORIES,
        "entity_types": ["user", "order", "service", "payment", "settings", "validation"],
        "severities": ["info", "warning", "error"]
    }


# Local permissions for operators to manage team audit view
class LocalPermissionUpdate(BaseModel):
    user_id: str
    permission: str
    action: str  # "add" or "remove"

@router.post("/local-permissions")
async def update_local_permission(
    request: LocalPermissionUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Allow operator owners to assign/remove local permissions (like team_audit.view)"""
    db = get_database()
    
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    operator_id = current_user.get("operator_id")
    
    # Only operators can manage local permissions
    if user_role != "operator":
        raise HTTPException(status_code=403, detail="Only operators can manage local permissions")
    
    # Check if current user is owner
    if not operator_id:
        raise HTTPException(status_code=403, detail="No operator context")
    
    operator_data = await db.operators.find_one({"_id": ObjectId(operator_id)}, {"owner_user_id": 1})
    if not operator_data or str(operator_data.get("owner_user_id")) != user_id:
        # Check if user has permission to assign permissions
        user_data = await db.users.find_one({"_id": ObjectId(user_id)}, {"local_permissions": 1})
        local_perms = user_data.get("local_permissions", []) if user_data else []
        if "team_permissions.manage" not in local_perms:
            raise HTTPException(status_code=403, detail="Only owner or users with team_permissions.manage can manage local permissions")
    
    # Verify target user belongs to same operator
    target_user = await db.users.find_one({"_id": ObjectId(request.user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get("operator_id") != operator_id:
        raise HTTPException(status_code=403, detail="Can only manage permissions for users in your operator")
    
    # Valid local permissions
    valid_permissions = ["team_audit.view", "team_permissions.manage"]
    if request.permission not in valid_permissions:
        raise HTTPException(status_code=400, detail=f"Invalid permission. Valid: {valid_permissions}")
    
    # Update user's local permissions
    if request.action == "add":
        await db.users.update_one(
            {"_id": ObjectId(request.user_id)},
            {"$addToSet": {"local_permissions": request.permission}}
        )
    elif request.action == "remove":
        await db.users.update_one(
            {"_id": ObjectId(request.user_id)},
            {"$pull": {"local_permissions": request.permission}}
        )
    else:
        raise HTTPException(status_code=400, detail="Action must be 'add' or 'remove'")
    
    return {"message": f"Permission {request.permission} {request.action}ed successfully"}

@router.get("/local-permissions/{user_id}")
async def get_local_permissions(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get local permissions for a user (owner only)"""
    db = get_database()
    
    operator_id = current_user.get("operator_id")
    
    # Verify target user belongs to same operator
    target_user = await db.users.find_one({"_id": ObjectId(user_id)}, {"local_permissions": 1, "operator_id": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get("operator_id") != operator_id:
        raise HTTPException(status_code=403, detail="Can only view permissions for users in your operator")
    
    return {"permissions": target_user.get("local_permissions", [])}

