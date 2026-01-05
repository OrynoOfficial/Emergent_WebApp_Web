from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission, get_all_permissions
from models.access import AccessGroupCreate, AccessGroupUpdate
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/access", tags=["Access Control"])

# Role Management
@router.get("/roles")
async def get_roles(
    current_user: dict = Depends(require_permission("access.view_roles"))
):
    """Get all roles - requires access.view_roles permission"""
    db = get_database()
    
    roles = await db.roles.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    
    # If no roles exist, return default roles
    if not roles:
        return {"roles": []}
    
    return {"roles": roles}

@router.post("/roles")
async def create_role(
    request: Request,
    current_user: dict = Depends(require_permission("access.create_roles"))
):
    """Create a new role - requires access.create_roles permission"""
    db = get_database()
    
    # Parse JSON body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    description = body.get("description", "")
    permissions = body.get("permissions", [])
    color = body.get("color", "bg-slate-100 text-slate-700 border-slate-200")
    
    # Check if role name exists
    existing = await db.roles.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    role = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "permissions": permissions,
        "color": color,
        "is_system": False,
        "user_count": 0,
        "created_by": str(current_user.get("id") or current_user.get("_id")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roles.insert_one(role)
    
    # Return serializable role (without MongoDB _id)
    response_role = {k: v for k, v in role.items() if k != "_id"}
    return {"message": "Role created successfully", "role_id": role["id"], "role": response_role}

@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    request: Request,
    current_user: dict = Depends(require_permission("access.edit_roles"))
):
    """Update a role - requires access.edit_roles permission"""
    db = get_database()
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Only super_admin can modify system roles
    if role.get("is_system") and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admin can modify system roles")
    
    # Parse JSON body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if "name" in body and body["name"]:
        update_data["name"] = body["name"]
    if "description" in body:
        update_data["description"] = body["description"]
    if "permissions" in body:
        update_data["permissions"] = body["permissions"]
    if "color" in body:
        update_data["color"] = body["color"]
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    return {"message": "Role updated successfully"}

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    current_user: dict = Depends(require_permission("access.delete_roles"))
):
    """Delete a role - requires access.delete_roles permission"""
    db = get_database()
    
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check for users with this role
    users_with_role = await db.users.count_documents({"custom_role": role_id})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role with {users_with_role} assigned users")
    
    await db.roles.delete_one({"id": role_id})
    
    return {"message": "Role deleted"}

# User Permission Management
@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a user's permissions and assigned roles"""
    db = get_database()
    
    # Users can view their own, those with users.view can view anyone's
    current_id = current_user.get("id") or current_user.get("_id")
    if str(current_id) != user_id:
        from utils.permissions import check_user_permission
        has_perm = await check_user_permission(current_user, "users.view", db)
        if not has_perm:
            raise HTTPException(status_code=403, detail="Permission denied. Required: users.view")
    
    # Try both id and _id fields for compatibility
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "custom_permissions": 1, "role": 1, "assigned_roles": 1})
    if not user:
        user = await db.users.find_one({"_id": user_id}, {"_id": 0, "custom_permissions": 1, "role": 1, "assigned_roles": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "role": user.get("role"),
        "custom_permissions": user.get("custom_permissions", []),
        "assigned_roles": user.get("assigned_roles", [])
    }

@router.put("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_permission("access.assign_roles"))
):
    """Update a user's assigned roles and custom permissions - requires access.assign_roles permission"""
    db = get_database()
    
    # Try both id and _id fields for compatibility
    user = await db.users.find_one({"id": user_id})
    if not user:
        user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Super admins can only be modified by other super admins
    if user.get("role") == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify super_admin permissions")
    
    # Parse JSON body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Support both assigned_roles and individual permissions
    if "assigned_roles" in body:
        update_data["assigned_roles"] = body["assigned_roles"]
    if "permissions" in body:
        update_data["custom_permissions"] = body["permissions"]
    
    # Update using the correct field
    await db.users.update_one(
        {"$or": [{"id": user_id}, {"_id": user_id}]},
        {"$set": update_data}
    )
    
    return {"message": "User permissions updated"}

# Permission Management
@router.get("/permissions")
async def get_permissions(
    module: Optional[str] = None,
    current_user: dict = Depends(require_permission("access.view_permissions"))
):
    """Get all permissions - requires access.view_permissions permission"""
    db = get_database()
    
    query = {}
    if module:
        query["module"] = module
    
    permissions = await db.permissions.find(query, {"_id": 0}).sort("module", 1).to_list(1000)
    
    return {"permissions": permissions}

@router.post("/permissions")
async def create_permission(
    name: str,
    code: str,
    module: str,
    description: Optional[str] = None,
    access_level: str = "read",
    current_user: dict = Depends(require_permission("access.manage_permissions"))
):
    """Create a permission - requires access.manage_permissions permission"""
    db = get_database()
    
    # Check if code exists
    existing = await db.permissions.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Permission code already exists")
    
    permission = {
        "_id": str(uuid.uuid4()),
        "name": name,
        "code": code,
        "description": description,
        "module": module,
        "access_level": access_level,
        "is_system": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.permissions.insert_one(permission)
    
    return {"message": "Permission created", "permission_id": permission["_id"]}

# Access Group Management
@router.post("/groups")
async def create_access_group(
    group_data: AccessGroupCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create an access group"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Operators can only create groups for their organization
    operator_id = None
    if current_user["role"] == "operator":
        operator_id = current_user.get("operator_id")
    elif group_data.operator_id:
        operator_id = group_data.operator_id
    
    group = {
        "_id": str(uuid.uuid4()),
        **group_data.dict(),
        "operator_id": operator_id,
        "is_system": False,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.access_groups.insert_one(group)
    
    return {"message": "Access group created", "group_id": group["_id"]}

@router.get("/groups")
async def get_access_groups(
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get access groups"""
    db = get_database()
    
    query = {}
    
    # Filter by operator
    if current_user["role"] == "operator":
        query["$or"] = [
            {"operator_id": current_user.get("operator_id")},
            {"operator_id": None}  # System groups
        ]
    elif operator_id:
        query["$or"] = [
            {"operator_id": operator_id},
            {"operator_id": None}
        ]
    
    groups = await db.access_groups.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.access_groups.count_documents(query)
    
    return {"groups": groups, "total": total}

@router.get("/groups/{group_id}")
async def get_access_group(group_id: str):
    """Get access group details"""
    db = get_database()
    group = await db.access_groups.find_one({"_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Access group not found")
    group["id"] = group_id
    return group

@router.put("/groups/{group_id}")
async def update_access_group(
    group_id: str,
    group_data: AccessGroupUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an access group"""
    db = get_database()
    
    group = await db.access_groups.find_one({"_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Access group not found")
    
    if group.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot modify system groups")
    
    # Check authorization
    if current_user["role"] == "operator":
        if group.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in group_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.access_groups.update_one({"_id": group_id}, {"$set": update_data})
    
    return {"message": "Access group updated"}

@router.delete("/groups/{group_id}")
async def delete_access_group(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete an access group"""
    db = get_database()
    
    group = await db.access_groups.find_one({"_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Access group not found")
    
    if group.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system groups")
    
    # Check for users assigned to this group
    assigned_users = await db.user_access.count_documents({"access_group_id": group_id, "is_active": True})
    if assigned_users > 0:
        raise HTTPException(status_code=400, detail="Cannot delete group with assigned users")
    
    await db.access_groups.delete_one({"_id": group_id})
    
    return {"message": "Access group deleted"}

# User Access Assignment
@router.post("/users/{user_id}/groups")
async def assign_user_to_group(
    user_id: str,
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Assign a user to an access group"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify group exists
    group = await db.access_groups.find_one({"_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Access group not found")
    
    # Check if already assigned
    existing = await db.user_access.find_one({
        "user_id": user_id,
        "access_group_id": group_id,
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already assigned to this group")
    
    assignment = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "access_group_id": group_id,
        "access_group_name": group["name"],
        "operator_id": group.get("operator_id"),
        "granted_by": current_user["_id"],
        "granted_at": datetime.utcnow(),
        "is_active": True
    }
    
    await db.user_access.insert_one(assignment)
    
    return {"message": "User assigned to group"}

@router.get("/users/{user_id}/groups")
async def get_user_groups(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's access groups"""
    db = get_database()
    
    # Users can view their own groups, admins can view anyone's
    if current_user["role"] not in ["admin", "super_admin"] and current_user["_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignments = await db.user_access.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"groups": assignments}

@router.delete("/users/{user_id}/groups/{group_id}")
async def remove_user_from_group(
    user_id: str,
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Remove a user from an access group"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.user_access.update_one(
        {"user_id": user_id, "access_group_id": group_id, "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {"message": "User removed from group"}

@router.get("/check")
async def check_permission_endpoint(
    permission_code: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Check if current user has a specific permission"""
    from utils.permissions import check_user_permission
    db = get_database()
    
    has_perm = await check_user_permission(current_user, permission_code, db)
    return {"has_permission": has_perm}

@router.get("/my-permissions")
async def get_my_permissions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all effective permissions for the current user"""
    from utils.permissions import get_user_effective_permissions
    db = get_database()
    
    user_id = current_user.get("_id") or current_user.get("id")
    user_role = current_user.get("role", "")
    
    # Get effective permissions
    permissions = await get_user_effective_permissions(user_id, db)
    
    # Get assigned roles details
    assigned_role_ids = current_user.get("assigned_roles", [])
    assigned_roles = []
    if assigned_role_ids:
        roles = await db.roles.find(
            {"$or": [{"id": {"$in": assigned_role_ids}}, {"name": {"$in": assigned_role_ids}}]},
            {"_id": 0}
        ).to_list(100)
        assigned_roles = roles
    
    return {
        "base_role": user_role,
        "assigned_roles": assigned_roles,
        "effective_permissions": list(permissions),
        "is_super_admin": user_role == "super_admin",
        "has_all_permissions": "*" in permissions or user_role == "super_admin"
    }

@router.get("/available-permissions")
async def get_available_permissions(
    current_user: dict = Depends(require_permission("access.view_permissions"))
):
    """Get all available permission codes grouped by module - requires access.view_permissions"""
    from utils.permissions import get_all_permissions
    
    permissions_by_module = get_all_permissions()
    
    # Format for frontend
    formatted = []
    for module, perms in permissions_by_module.items():
        module_perms = []
        for perm_code in perms:
            action = perm_code.split(".")[-1]
            module_perms.append({
                "code": perm_code,
                "module": module,
                "action": action,
                "label": f"{action.replace('_', ' ').title()}"
            })
        formatted.append({
            "module": module,
            "label": module.replace("_", " ").title(),
            "permissions": module_perms
        })
    
    return {"permission_groups": formatted}
