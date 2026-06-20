from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user, invalidate_user_cache
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

    # Transform _id to id and enrich operator_name for users missing it
    missing_op_ids = {u.get("operator_id") for u in users if u.get("operator_id") and not u.get("operator_name")}
    op_name_map = {}
    if missing_op_ids:
        async for op in db.operators.find({"_id": {"$in": list(missing_op_ids)}}, {"name": 1}):
            op_name_map[op["_id"]] = op.get("name")

    for user in users:
        user["id"] = str(user.pop("_id", ""))
        if user.get("operator_id") and not user.get("operator_name"):
            user["operator_name"] = op_name_map.get(user["operator_id"])

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


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Real statistics for a user — orders/spend/etc. Users can view own, others need users.view."""
    db = get_database()
    if current_user["_id"] != user_id:
        from utils.permissions import check_user_permission
        has_perm = await check_user_permission(current_user, "users.view", db)
        if not has_perm:
            raise HTTPException(status_code=403, detail="Permission denied")

    target = await db.users.find_one({"_id": user_id}, {"_id": 1, "email": 1, "role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Aggregate orders by this user.
    base = {"$or": [{"user_id": user_id}, {"user_email": target.get("email")}]}
    total_orders = await db.orders.count_documents(base)
    completed = await db.orders.count_documents({**base, "status": {"$in": ["completed", "confirmed", "paid"]}})
    pending = await db.orders.count_documents({**base, "status": {"$in": ["pending", "awaiting_payment"]}})
    cancelled = await db.orders.count_documents({**base, "status": "cancelled"})

    spent_agg = await db.orders.aggregate([
        {"$match": {**base, "status": {"$in": ["completed", "confirmed", "paid"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]).to_list(1)
    total_spent = spent_agg[0]["total"] if spent_agg else 0

    # Most-used service
    by_service = await db.orders.aggregate([
        {"$match": base},
        {"$group": {"_id": "$service_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1},
    ]).to_list(1)
    favorite_service = by_service[0]["_id"] if by_service else None

    last_order_doc = await db.orders.find_one(base, sort=[("created_at", -1)])
    last_order_at = last_order_doc.get("created_at") if last_order_doc else None
    if last_order_at and hasattr(last_order_at, "isoformat"):
        last_order_at = last_order_at.isoformat()

    return {
        "total_orders": total_orders,
        "completed_orders": completed,
        "pending_orders": pending,
        "cancelled_orders": cancelled,
        "total_spent": total_spent,
        "favorite_service": favorite_service,
        "last_order_at": last_order_at,
    }

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
    allowed_admin_fields = ["status", "email_verified", "operator_id"]
    
    # Filter update data based on permissions
    if current_user["_id"] == user_id:
        filtered_data = {k: v for k, v in update_data.items() if k in allowed_self_fields}
    else:
        all_allowed = allowed_self_fields + allowed_admin_fields
        filtered_data = {k: v for k, v in update_data.items() if k in all_allowed}
    
    if not filtered_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # Handle operator_id assignment/removal — only allowed for role='operator'.
    # Admins may pass operator_id=null to explicitly remove assignment.
    if "operator_id" in filtered_data:
        if target_user.get("role") != "operator":
            raise HTTPException(
                status_code=400,
                detail="operator_id can only be set on users with role 'operator'",
            )
        new_op_id = filtered_data.get("operator_id")
        if new_op_id:
            op = await db.operators.find_one({"_id": new_op_id}, {"name": 1})
            if not op:
                raise HTTPException(status_code=404, detail="Operator not found")
            filtered_data["operator_name"] = op.get("name")
        else:
            # Explicit removal
            filtered_data["operator_id"] = None
            filtered_data["operator_name"] = None

    filtered_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one({"_id": user_id}, {"$set": filtered_data})
    await invalidate_user_cache(user_id)
    
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
    update_payload = {"role": new_role, "updated_at": datetime.utcnow()}
    role_unset = {}
    # Cascade: if the user is being demoted/moved away from 'operator',
    # automatically unset operator_id and operator_name. An admin must explicitly
    # re-assign an operator on the next edit to restore association.
    if current_role == "operator" and new_role != "operator":
        role_unset = {"operator_id": "", "operator_name": ""}

    update_op = {"$set": update_payload}
    if role_unset:
        update_op["$unset"] = role_unset

    await db.users.update_one(
        {"$or": [{"id": user_id}, {"_id": user_id}]},
        update_op,
    )
    await invalidate_user_cache(user_id)

    return {
        "message": f"User role updated to {new_role}",
        "new_role": new_role,
        "operator_cleared": bool(role_unset),
    }

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
    await invalidate_user_cache(user_id)
    
    action = "suspended" if new_status == "suspended" else "activated"
    return {"message": f"User {action} successfully"}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date"),
    date_to: Optional[str] = Query(None, description="ISO date"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's activity/audit log — with optional search, date range, and pagination."""
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

    # Date range — applied to either created_at or timestamp depending on collection.
    date_clause_audit = {}
    date_clause_activity = {}
    if date_from:
        date_clause_audit["$gte"] = date_from
        date_clause_activity["$gte"] = date_from
    if date_to:
        # include end-of-day by appending T23:59:59 if a plain date was passed
        dt_to = date_to if "T" in date_to else f"{date_to}T23:59:59"
        date_clause_audit["$lte"] = dt_to
        date_clause_activity["$lte"] = dt_to
    if date_clause_audit:
        audit_query = {"$and": [audit_query, {"$or": [{"created_at": date_clause_audit}, {"timestamp": date_clause_audit}]}]}
        activity_query = {"$and": [activity_query, {"timestamp": date_clause_activity}]}

    # Search — fuzzy match on action/description/resource_type
    if search:
        regex = {"$regex": search, "$options": "i"}
        search_or = [{"action": regex}, {"description": regex}, {"resource_type": regex}]
        audit_query = {"$and": [audit_query, {"$or": search_or}]}
        activity_query = {"$and": [activity_query, {"$or": search_or}]}

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
    """Create a new user. When `send_invite=true` the user is created in
    pending_verification state and an invitation email is sent so they can
    confirm their account before logging in."""
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

    send_invite = bool(user_data.get("send_invite", False))
    # When inviting AND no password provided, generate a random placeholder.
    # The invitee will set their own password on /verify-account.
    raw_password = user_data.get("password")
    has_temp_password = bool(raw_password)
    if not raw_password:
        import secrets as _secrets
        raw_password = _secrets.token_urlsafe(24)

    # Resolve assigned custom roles → merge their bundled permissions into the
    # user's `permissions[]` so role membership has real teeth at runtime.
    # `assigned_role_ids` itself is also persisted for future inspection/UI.
    requested_role_ids = list(user_data.get("assigned_role_ids") or [])
    merged_permissions = list(user_data.get("permissions") or [])
    if requested_role_ids:
        role_docs = await db.roles.find(
            {"id": {"$in": requested_role_ids}},
            {"_id": 0, "id": 1, "permissions": 1}
        ).to_list(len(requested_role_ids))
        # Drop any role_ids that didn't resolve so we don't persist phantoms.
        requested_role_ids = [r["id"] for r in role_docs]
        for r in role_docs:
            for p in (r.get("permissions") or []):
                if p not in merged_permissions:
                    merged_permissions.append(p)

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "id": user_id,
        "email": user_data.get("email"),
        "username": user_data.get("username"),
        "password_hash": get_password_hash(raw_password),
        "full_name": user_data.get("full_name"),
        "phone": user_data.get("phone"),
        "role": new_role,
        "permissions": merged_permissions,
        "assigned_role_ids": requested_role_ids,
        "status": "pending_verification" if send_invite else user_data.get("status", "active"),
        "email_verified": False if send_invite else True,
        "two_fa_enabled": False,
        # Admin-provisioned credentials → force rotation on first sign-in.
        # `verify-account` clears this when the invitee chooses their own password.
        "must_reset_password": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    # For operator role, require & persist operator_id
    if new_role == "operator":
        operator_id = user_data.get("operator_id")
        if not operator_id:
            raise HTTPException(
                status_code=400,
                detail="operator_id is required when creating an operator user",
            )
        op = await db.operators.find_one({"_id": operator_id}, {"name": 1})
        if not op:
            raise HTTPException(status_code=404, detail="Operator not found")
        user["operator_id"] = operator_id
        user["operator_name"] = op.get("name")
        if user_data.get("operator_role"):
            user["operator_role"] = user_data["operator_role"]

    await db.users.insert_one(user)

    # Bump the user_count on each assigned role for UI display.
    if requested_role_ids:
        await db.roles.update_many(
            {"id": {"$in": requested_role_ids}},
            {"$inc": {"user_count": 1}}
        )

    invite_link = None
    invite_email_status = None
    if send_invite:
        import secrets as _secrets
        from os import environ as _env
        from datetime import timedelta as _td
        invite_token = _secrets.token_urlsafe(32)
        _public = _env.get("APP_PUBLIC_URL", "").rstrip("/")
        invite_link = f"{_public}/verify-account?token={invite_token}" if _public else None
        await db.verification_tokens.insert_one({
            "_id": invite_token,
            "user_id": user_id,
            "user_email": user["email"],
            "purpose": "account_invite",
            "operator_id": user.get("operator_id"),
            "operator_name": user.get("operator_name"),
            "has_temp_password": has_temp_password,
            "consumed_at": None,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + _td(days=7),
        })
        try:
            from services.email_service import send_account_invite_email
            await send_account_invite_email(
                recipient_email=user["email"],
                recipient_name=user.get("full_name") or user["email"],
                invite_token=invite_token,
                operator_name=user.get("operator_name"),
                inviter_name=current_user.get("full_name"),
                has_temp_password=has_temp_password,
            )
            invite_email_status = "sent"
        except Exception:
            import logging
            logging.exception("Failed to send user invite email")
            invite_email_status = "failed"
    
    return {
        "message": "User created successfully",
        "user_id": user["_id"],
        "send_invite": send_invite,
        "invite_link": invite_link,
        "invite_email_status": invite_email_status,
        "default_password": raw_password if has_temp_password else None,
    }

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
    
    # Block deletion of protected system accounts (e.g. bootstrap super-admin).
    # These are seeded on startup and must always exist so a tenant can never
    # accidentally lock themselves out of the platform.
    if target_user.get("is_system_account") is True or target_user.get("is_protected") is True:
        raise HTTPException(
            status_code=403,
            detail="This is a protected system account and cannot be deleted."
        )
    
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
    await invalidate_user_cache(current_user["_id"])
    
    return {"message": "Notification preferences updated successfully"}

@router.get("/me/preferences")
async def get_user_preferences(
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's preferences with defaults."""
    user = current_user
    return {
        "language": user.get("language", "en"),
        "currency": user.get("currency", "XAF"),
        "timezone": user.get("timezone"),
        "theme": user.get("theme", "light"),
        # Display preferences
        "date_format": user.get("date_format", "DD/MM/YYYY"),
        "time_format": user.get("time_format", "24h"),
        "first_day_of_week": user.get("first_day_of_week", "monday"),
        "number_format": user.get("number_format", "fr"),  # fr = 1 234,56 / en = 1,234.56
        "distance_unit": user.get("distance_unit", "km"),
        "temperature_unit": user.get("temperature_unit", "celsius"),
        # App behaviour
        "default_landing_page": user.get("default_landing_page", "auto"),
        "default_search_radius_km": user.get("default_search_radius_km", 25),
        "results_per_page": user.get("results_per_page", 20),
        # Communication & privacy
        "marketing_opt_in": user.get("marketing_opt_in", False),
        "show_profile_publicly": user.get("show_profile_publicly", False),
        "share_usage_data": user.get("share_usage_data", True),
        # Accessibility
        "reduce_motion": user.get("reduce_motion", False),
        "high_contrast": user.get("high_contrast", False),
        "font_scale": user.get("font_scale", "normal"),  # small / normal / large
    }


@router.put("/me/preferences")
async def update_user_preferences(
    preferences: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user's general preferences (language, currency, timezone, theme + extended)"""
    db = get_database()
    
    # Allowed preference fields (extended set)
    allowed_fields = [
        "language", "currency", "timezone", "theme",
        "date_format", "time_format", "first_day_of_week",
        "number_format", "distance_unit", "temperature_unit",
        "default_landing_page", "default_search_radius_km", "results_per_page",
        "marketing_opt_in", "show_profile_publicly", "share_usage_data",
        "reduce_motion", "high_contrast", "font_scale",
    ]
    
    # Filter
    update_data = {k: v for k, v in preferences.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": update_data}
    )
    await invalidate_user_cache(current_user["_id"])
    
    return {"message": "Preferences updated successfully"}
