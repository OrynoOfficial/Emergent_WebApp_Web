from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from models.user import UserRole, UserStatus, can_manage_role, ROLE_HIERARCHY
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/")
async def get_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    user_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("users.view"))
):
    """Get users list - requires users.view permission"""
    db = get_database()
    
    query = {}
    
    # Role-based filtering: Admin can only see admin, operator, employee, customer (NOT super_admin)
    current_role = current_user.get("role")
    if current_role == "admin":
        # Admin can see: admin, operator, employee, customer (NOT super_admin)
        query["role"] = {"$in": ["admin", "operator", "employee", "customer"]}
    # Super Admin can see all users (no filter)
    
    if search:
        search_query = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}}
        ]
        if "$or" not in query:
            query["$or"] = search_query
        else:
            # Combine with existing filters
            query = {"$and": [query, {"$or": search_query}]}
    
    if role and role != "all":
        # Apply role filter only if it's within what the current user can see
        if current_role == "admin" and role == "super_admin":
            # Admin trying to filter by super_admin - return empty
            return {"users": [], "total": 0, "skip": skip, "limit": limit}
        if "role" in query and isinstance(query["role"], dict):
            # Already have role filter, combine
            if role in query["role"]["$in"]:
                query["role"] = role
            else:
                return {"users": [], "total": 0, "skip": skip, "limit": limit}
        else:
            query["role"] = role
    
    if user_status and user_status != "all":
        query["status"] = user_status
    
    # Exclude password hash and sensitive fields
    projection = {
        "password_hash": 0,
        "two_fa_secret": 0,
        "email_verification_token": 0,
        "password_reset_token": 0
    }
    
    users = await db.users.find(query, projection).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    # Transform _id to id
    for user in users:
        user["id"] = str(user.pop("_id", ""))
    
    return {"users": users, "total": total, "skip": skip, "limit": limit}

@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user details - users can view their own profile, others need users.view permission"""
    db = get_database()
    
    # Users can view their own profile
    if current_user["_id"] != user_id:
        # Check permission for viewing other users
        from utils.permissions import check_user_permission
        has_perm = await check_user_permission(current_user, "users.view", db)
        if not has_perm:
            raise HTTPException(status_code=403, detail="Permission denied. Required: users.view")
    
    user = await db.users.find_one(
        {"_id": user_id},
        {"password_hash": 0, "two_fa_secret": 0, "email_verification_token": 0, "password_reset_token": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["id"] = str(user.pop("_id", ""))
    return user

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user profile - self-update or requires users.edit permission"""
    db = get_database()
    
    # Get target user
    target_user = await db.users.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Users can update their own profile, others need users.edit permission
    if current_user["_id"] != user_id:
        from utils.permissions import check_user_permission
        has_perm = await check_user_permission(current_user, "users.edit", db)
        if not has_perm:
            raise HTTPException(status_code=403, detail="Permission denied. Required: users.edit")
        # Check role hierarchy for admins
        if not can_manage_role(current_user["role"], target_user["role"]):
            raise HTTPException(status_code=403, detail="Cannot modify user with equal or higher role")
    
    # Allowed fields for self-update (expanded list)
    allowed_self_fields = [
        "full_name", "phone", "profile_picture", "avatar_url", 
        "language", "currency", "timezone", "email",
        "date_of_birth", "gender", "address", "city", 
        "region", "postal_code", "country", "id_document_number"
    ]
    # Additional fields for admin updates
    allowed_admin_fields = ["status", "email_verified"]
    
    # Filter update data based on permissions
    if current_user["_id"] == user_id:
        filtered_data = {k: v for k, v in update_data.items() if k in allowed_self_fields}
    else:
        all_allowed = allowed_self_fields + allowed_admin_fields
        filtered_data = {k: v for k, v in update_data.items() if k in all_allowed}
    
    if not filtered_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    filtered_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one({"_id": user_id}, {"$set": filtered_data})
    
    return {"message": "User updated successfully"}

@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_data: dict,
    current_user: dict = Depends(require_permission("users.manage_roles"))
):
    """Update user role - requires users.manage_roles permission"""
    db = get_database()
    
    new_role = role_data.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Role is required")
    
    # Validate role - support both enum values and string values
    valid_roles = [r.value for r in UserRole] + ["user", "employee", "customer"]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    # Get target user - support both id and _id fields
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        target_user = await db.users.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission checks
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    current_role = target_user.get("role", "user")
    
    # Check if current user can manage target user's current role
    if not can_manage_role(current_user["role"], current_role):
        raise HTTPException(status_code=403, detail="Cannot modify user with equal or higher role")
    
    # Check if current user can assign the new role
    # Only super_admin can create other super_admins or admins
    if new_role == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can assign super admin role")
    
    if new_role == "admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can assign admin role")
    
    # Update using both possible id fields
    await db.users.update_one(
        {"$or": [{"id": user_id}, {"_id": user_id}]},
        {"$set": {"role": new_role, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"User role updated to {new_role}", "new_role": new_role}

@router.put("/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Suspend or activate a user (with role hierarchy check)"""
    db = get_database()
    
    new_status = status_data.get("status")
    if new_status not in ["active", "suspended", "inactive"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get target user
    target_user = await db.users.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot suspend yourself
    if current_user["_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    
    # Permission checks - must be admin or super_admin
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check role hierarchy - can only suspend users with lower role
    if not can_manage_role(current_user["role"], target_user["role"]):
        raise HTTPException(status_code=403, detail="Cannot suspend user with equal or higher role")
    
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    action = "suspended" if new_status == "suspended" else "activated"
    return {"message": f"User {action} successfully"}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's activity/audit log - own activity or requires users.view_activity permission"""
    db = get_database()
    
    # Check if user has permission to view activity
    is_own_activity = current_user["_id"] == user_id
    
    if not is_own_activity:
        from utils.permissions import check_user_permission
        has_perm = await check_user_permission(current_user, "users.view_activity", db)
        if not has_perm:
            raise HTTPException(status_code=403, detail="Permission denied. Required: users.view_activity")
    
    # Verify target user exists
    target_user = await db.users.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Query activity_logs for this user - match by actor_id OR actor_email
    user_email = target_user.get("email")
    activity_query = {"$or": [{"actor_id": user_id}]}
    if user_email:
        activity_query["$or"].append({"actor_email": user_email})
    
    # Audit logs may use user_id or actor_id
    audit_query = {"$or": [{"user_id": user_id}, {"actor_id": user_id}]}
    if user_email:
        audit_query["$or"].append({"actor_email": user_email})
    
    # Get from audit_logs collection
    audit_logs = await db.audit_logs.find(audit_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total_audit = await db.audit_logs.count_documents(audit_query)
    
    # Get from activity_logs collection
    activity_logs = await db.activity_logs.find(activity_query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total_activity = await db.activity_logs.count_documents(activity_query)
    
    # Combine and format
    combined_activities = []
    
    for log in audit_logs:
        combined_activities.append({
            "id": str(log.get("_id", "")),
            "type": "audit",
            "action": log.get("action", "unknown"),
            "description": log.get("description", log.get("action", "")),
            "details": log.get("details"),
            "ip_address": log.get("ip_address"),
            "user_agent": log.get("user_agent"),
            "created_at": log.get("created_at") or log.get("timestamp"),
            "resource_type": log.get("resource_type"),
            "resource_id": log.get("resource_id")
        })
    
    for log in activity_logs:
        combined_activities.append({
            "id": str(log.get("_id", "")),
            "type": "activity",
            "action": log.get("action", log.get("type", "unknown")),
            "description": log.get("description", log.get("action", "")),
            "details": log.get("details") or log.get("metadata"),
            "ip_address": log.get("ip_address"),
            "user_agent": log.get("user_agent"),
            "created_at": log.get("created_at") or log.get("timestamp"),
            "page": log.get("page"),
            "path": log.get("path")
        })
    
    # Sort combined by created_at descending
    combined_activities.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    
    # Limit to requested size
    combined_activities = combined_activities[:limit]
    
    return {
        "activities": combined_activities,
        "total": total_audit + total_activity,
        "user_id": user_id,
        "user_name": target_user.get("full_name", "Unknown")
    }


@router.post("/create")
async def create_user(
    user_data: dict,
    current_user: dict = Depends(require_permission("users.create"))
):
    """Create a new user - requires users.create permission"""
    from utils.auth import get_password_hash
    
    db = get_database()
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.get("email")})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role assignment
    new_role = user_data.get("role", "customer")
    if new_role == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can create super admins")
    if new_role == "admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can create admins")
    
    # Create user
    user = {
        "_id": str(uuid.uuid4()),
        "email": user_data.get("email"),
        "username": user_data.get("username"),
        "password_hash": get_password_hash(user_data.get("password", "defaultpass123")),
        "full_name": user_data.get("full_name"),
        "phone": user_data.get("phone"),
        "role": new_role,
        "status": user_data.get("status", "active"),
        "email_verified": True,
        "two_fa_enabled": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    return {"message": "User created successfully", "user_id": user["_id"]}

@router.get("/permissions/check")
async def check_permissions(
    target_role: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Check if current user can manage a specific role"""
    can_manage = can_manage_role(current_user["role"], target_role)
    return {
        "can_manage": can_manage,
        "current_role": current_user["role"],
        "target_role": target_role
    }

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_permission("users.delete"))
):
    """Delete a user - requires users.delete permission"""
    db = get_database()
    
    # Cannot delete yourself
    if current_user["_id"] == user_id or current_user.get("id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Get target user - support both id and _id fields
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        target_user = await db.users.find_one({"_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check role hierarchy - can only delete users with lower role
    if not can_manage_role(current_user["role"], target_user.get("role", "customer")):
        raise HTTPException(status_code=403, detail="Cannot delete user with equal or higher role")
    
    # Prevent deletion of super_admin by non-super_admin
    if target_user.get("role") == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can delete super admin accounts")
    
    # Cascade: remove from pods, scopes, teams
    from utils.cascade import cascade_delete_user
    remover_id = str(current_user.get("_id") or current_user.get("id"))
    cascade_result = await cascade_delete_user(db, user_id, remover_id)

    # Delete the user
    result = await db.users.delete_one({"$or": [{"id": user_id}, {"_id": user_id}]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found or already deleted")
    
    return {
        "message": "User deleted successfully",
        "deleted_user_id": user_id,
        "cascade": cascade_result
    }



@router.get("/me/notifications")
async def get_notification_preferences(
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's notification preferences"""
    db = get_database()
    
    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return notification preferences with defaults
    return {
        "email_notifications": user.get("email_notifications", True),
        "sms_notifications": user.get("sms_notifications", False),
        "push_notifications": user.get("push_notifications", True),
        "booking_updates": user.get("booking_updates", True),
        "promotional": user.get("promotional", False),
        "newsletter": user.get("newsletter", False),
    }

@router.put("/me/notifications")
async def update_notification_preferences(
    preferences: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user's notification preferences"""
    db = get_database()
    
    # Allowed notification fields
    allowed_fields = [
        "email_notifications", "sms_notifications", "push_notifications",
        "booking_updates", "promotional", "newsletter"
    ]
    
    # Filter and validate
    update_data = {k: bool(v) for k, v in preferences.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Notification preferences updated successfully"}

@router.put("/me/preferences")
async def update_user_preferences(
    preferences: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user's general preferences (language, currency, timezone, theme)"""
    db = get_database()
    
    # Allowed preference fields
    allowed_fields = ["language", "currency", "timezone", "theme"]
    
    # Filter
    update_data = {k: v for k, v in preferences.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Preferences updated successfully"}
