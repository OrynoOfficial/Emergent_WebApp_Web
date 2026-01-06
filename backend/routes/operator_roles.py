"""
Operator Roles and Permissions Management API
Handles custom roles, permission delegation, and access control within operators
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions_config import (
    OPERATOR_PERMISSIONS, DEFAULT_OPERATOR_ROLES, SERVICE_TYPES,
    get_role_permissions, get_delegatable_permissions, can_delegate_permission
)
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/operator-roles", tags=["Operator Roles"])


# ==================== Pydantic Models ====================

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class PermissionDelegate(BaseModel):
    user_id: str
    permissions: List[str]


class UserPermissionsUpdate(BaseModel):
    role_id: Optional[str] = None  # Assign a custom role
    additional_permissions: Optional[List[str]] = None  # Extra permissions beyond role


# ==================== Helper Functions ====================

async def verify_operator_owner_access(current_user: dict, operator_id: str, db):
    """Verify user is owner of the operator or platform admin"""
    if current_user["role"] in ["super_admin", "admin"]:
        return True
    
    if current_user.get("operator_id") != operator_id:
        raise HTTPException(status_code=403, detail="Access denied to this operator")
    
    if current_user.get("operator_role") != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage roles")
    
    return True


async def get_user_effective_permissions(user: dict, db) -> List[str]:
    """Calculate effective permissions for a user"""
    permissions = []
    
    # Platform role permissions
    platform_role = user.get("role", "customer")
    operator_role = user.get("operator_role")
    
    # Get base permissions from roles
    permissions.extend(get_role_permissions(platform_role, operator_role))
    
    # Add custom role permissions if assigned
    if user.get("custom_role_id"):
        custom_role = await db.operator_roles.find_one({"_id": user["custom_role_id"]})
        if custom_role:
            permissions.extend(custom_role.get("permissions", []))
    
    # Add individually granted permissions
    permissions.extend(user.get("granted_permissions", []))
    
    # Add scoped permissions
    permissions.extend(user.get("scoped_permissions", []))
    
    return list(set(permissions))


# ==================== Roles Endpoints ====================

@router.get("/operators/{operator_id}/roles")
async def get_operator_roles(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all roles for an operator (system + custom)"""
    db = get_database()
    
    # Verify access
    if current_user["role"] not in ["super_admin", "admin"]:
        if current_user.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get custom roles
    custom_roles = await db.operator_roles.find(
        {"operator_id": operator_id}
    ).to_list(100)
    
    for role in custom_roles:
        role["id"] = str(role.pop("_id", ""))
    
    # Combine with system roles
    system_roles = []
    for role_id, role_data in DEFAULT_OPERATOR_ROLES.items():
        system_roles.append({
            "id": role_id,
            "name": role_data["name"],
            "description": role_data["description"],
            "permissions": role_data["permissions"],
            "is_system": True,
            "can_be_deleted": False
        })
    
    return {
        "system_roles": system_roles,
        "custom_roles": custom_roles
    }


@router.post("/operators/{operator_id}/roles")
async def create_custom_role(
    operator_id: str,
    role_data: RoleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom role for an operator"""
    db = get_database()
    
    # Verify owner access
    await verify_operator_owner_access(current_user, operator_id, db)
    
    # Validate permissions - owner can only delegate permissions they have
    owner_permissions = await get_user_effective_permissions(current_user, db)
    delegatable = get_delegatable_permissions(owner_permissions)
    
    invalid_permissions = [p for p in role_data.permissions if p not in delegatable]
    if invalid_permissions:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delegate permissions you don't have: {invalid_permissions}"
        )
    
    # Check for duplicate name
    existing = await db.operator_roles.find_one({
        "operator_id": operator_id,
        "name": {"$regex": f"^{role_data.name}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="A role with this name already exists")
    
    # Create the role
    new_role = {
        "_id": str(uuid.uuid4()),
        "operator_id": operator_id,
        "name": role_data.name,
        "description": role_data.description,
        "permissions": role_data.permissions,
        "is_system": False,
        "can_be_deleted": True,
        "created_by": current_user["_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.operator_roles.insert_one(new_role)
    
    new_role["id"] = new_role.pop("_id")
    return {"message": "Role created successfully", "role": new_role}


@router.put("/operators/{operator_id}/roles/{role_id}")
async def update_custom_role(
    operator_id: str,
    role_id: str,
    role_data: RoleUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom role"""
    db = get_database()
    
    # Verify owner access
    await verify_operator_owner_access(current_user, operator_id, db)
    
    # Check if it's a system role
    if role_id in DEFAULT_OPERATOR_ROLES:
        raise HTTPException(status_code=400, detail="Cannot modify system roles")
    
    # Get the role
    role = await db.operator_roles.find_one({"_id": role_id, "operator_id": operator_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Validate permissions if updating
    if role_data.permissions is not None:
        owner_permissions = await get_user_effective_permissions(current_user, db)
        delegatable = get_delegatable_permissions(owner_permissions)
        
        invalid_permissions = [p for p in role_data.permissions if p not in delegatable]
        if invalid_permissions:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delegate permissions you don't have: {invalid_permissions}"
            )
    
    # Build update
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if role_data.name:
        update_fields["name"] = role_data.name
    if role_data.description is not None:
        update_fields["description"] = role_data.description
    if role_data.permissions is not None:
        update_fields["permissions"] = role_data.permissions
    
    await db.operator_roles.update_one({"_id": role_id}, {"$set": update_fields})
    
    return {"message": "Role updated successfully"}


@router.delete("/operators/{operator_id}/roles/{role_id}")
async def delete_custom_role(
    operator_id: str,
    role_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom role"""
    db = get_database()
    
    # Verify owner access
    await verify_operator_owner_access(current_user, operator_id, db)
    
    # Check if it's a system role
    if role_id in DEFAULT_OPERATOR_ROLES:
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Get the role
    role = await db.operator_roles.find_one({"_id": role_id, "operator_id": operator_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if not role.get("can_be_deleted", True):
        raise HTTPException(status_code=400, detail="This role cannot be deleted")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"custom_role_id": role_id})
    if users_with_role > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role - {users_with_role} users are assigned to it"
        )
    
    await db.operator_roles.delete_one({"_id": role_id})
    
    return {"message": "Role deleted successfully"}


# ==================== Permission Delegation Endpoints ====================

@router.get("/operators/{operator_id}/delegatable-permissions")
async def get_delegatable_permissions_list(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get list of permissions the current user can delegate"""
    db = get_database()
    
    # Verify access
    if current_user["role"] not in ["super_admin", "admin"]:
        if current_user.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("operator_role") not in ["owner", "local_admin"]:
            raise HTTPException(status_code=403, detail="Only owners and admins can delegate permissions")
    
    # Get user's effective permissions
    user_permissions = await get_user_effective_permissions(current_user, db)
    
    # Filter to delegatable (operator-scoped) permissions
    delegatable = get_delegatable_permissions(user_permissions)
    
    # Group by category
    grouped = {}
    for perm in delegatable:
        parts = perm.split(".")
        if len(parts) >= 2:
            category = parts[1]  # e.g., "services", "bookings", "team"
            if category not in grouped:
                grouped[category] = []
            grouped[category].append({
                "id": perm,
                "label": OPERATOR_PERMISSIONS.get(perm, perm)
            })
    
    return {
        "permissions": delegatable,
        "grouped": grouped,
        "total": len(delegatable)
    }


@router.post("/operators/{operator_id}/users/{user_id}/permissions")
async def delegate_permissions_to_user(
    operator_id: str,
    user_id: str,
    delegation: PermissionDelegate,
    current_user: dict = Depends(get_current_active_user)
):
    """Delegate specific permissions to a user"""
    db = get_database()
    
    # Verify access
    if current_user["role"] not in ["super_admin", "admin"]:
        if current_user.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("operator_role") not in ["owner", "local_admin"]:
            raise HTTPException(status_code=403, detail="Only owners and admins can delegate permissions")
    
    # Get target user
    target_user = await db.users.find_one({"_id": user_id, "operator_id": operator_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in this operator")
    
    # Cannot modify owner's permissions
    if target_user.get("operator_role") == "owner":
        raise HTTPException(status_code=400, detail="Cannot modify owner's permissions")
    
    # Validate delegator has these permissions
    delegator_permissions = await get_user_effective_permissions(current_user, db)
    delegatable = get_delegatable_permissions(delegator_permissions)
    
    invalid = [p for p in delegation.permissions if p not in delegatable]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delegate permissions you don't have: {invalid}"
        )
    
    # Update user's granted permissions
    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "granted_permissions": delegation.permissions,
                "permissions_granted_by": current_user["_id"],
                "permissions_granted_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Permissions delegated successfully", "permissions": delegation.permissions}


@router.put("/operators/{operator_id}/users/{user_id}/role")
async def assign_role_to_user(
    operator_id: str,
    user_id: str,
    role_assignment: UserPermissionsUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Assign a custom role to a user"""
    db = get_database()
    
    # Verify access
    if current_user["role"] not in ["super_admin", "admin"]:
        if current_user.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("operator_role") not in ["owner", "local_admin"]:
            raise HTTPException(status_code=403, detail="Only owners and admins can assign roles")
    
    # Get target user
    target_user = await db.users.find_one({"_id": user_id, "operator_id": operator_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in this operator")
    
    # Cannot modify owner's role
    if target_user.get("operator_role") == "owner":
        raise HTTPException(status_code=400, detail="Cannot modify owner's role")
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Validate and assign custom role
    if role_assignment.role_id:
        # Check if it's a system role or custom role
        if role_assignment.role_id in DEFAULT_OPERATOR_ROLES:
            # System role - update operator_role
            update_fields["operator_role"] = role_assignment.role_id
            update_fields["custom_role_id"] = None
        else:
            # Custom role - verify it exists
            custom_role = await db.operator_roles.find_one({
                "_id": role_assignment.role_id,
                "operator_id": operator_id
            })
            if not custom_role:
                raise HTTPException(status_code=404, detail="Role not found")
            
            update_fields["custom_role_id"] = role_assignment.role_id
    
    # Add additional permissions if provided
    if role_assignment.additional_permissions:
        # Validate delegator has these permissions
        delegator_permissions = await get_user_effective_permissions(current_user, db)
        delegatable = get_delegatable_permissions(delegator_permissions)
        
        invalid = [p for p in role_assignment.additional_permissions if p not in delegatable]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delegate permissions you don't have: {invalid}"
            )
        
        update_fields["granted_permissions"] = role_assignment.additional_permissions
    
    await db.users.update_one({"_id": user_id}, {"$set": update_fields})
    
    return {"message": "Role assigned successfully"}


# ==================== User Permissions Query ====================

@router.get("/users/me/permissions")
async def get_my_permissions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's effective permissions"""
    db = get_database()
    
    permissions = await get_user_effective_permissions(current_user, db)
    
    # Get service types if operator user
    service_types = []
    if current_user.get("operator_id"):
        operator = await db.operators.find_one({"_id": current_user["operator_id"]})
        if operator:
            op_type = operator.get("operator_type")
            if op_type:
                # Handle multiple service types
                if isinstance(op_type, list):
                    service_types = op_type
                else:
                    service_types = [op_type]
    
    # Map service types to their config
    services = []
    for st in service_types:
        if st in SERVICE_TYPES:
            services.append({
                "type": st,
                **SERVICE_TYPES[st]
            })
    
    return {
        "user_id": current_user["_id"],
        "platform_role": current_user.get("role"),
        "operator_id": current_user.get("operator_id"),
        "operator_name": current_user.get("operator_name"),
        "operator_role": current_user.get("operator_role"),
        "custom_role_id": current_user.get("custom_role_id"),
        "permissions": permissions,
        "service_types": services,
        "is_operator_user": bool(current_user.get("operator_id"))
    }


@router.get("/permissions/all")
async def get_all_permissions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all available permissions (for admin reference)"""
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "global_permissions": OPERATOR_PERMISSIONS,
        "operator_permissions": OPERATOR_PERMISSIONS,
        "service_types": SERVICE_TYPES,
        "default_roles": {
            k: {**v, "permissions_count": len(v["permissions"])}
            for k, v in DEFAULT_OPERATOR_ROLES.items()
        }
    }
