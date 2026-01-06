"""
Operator Users Management API
Handles user assignment, creation, and management within operators
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, EmailStr
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.user import UserRole, UserStatus, OperatorUserRole, OPERATOR_ROLE_HIERARCHY
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import bcrypt

router = APIRouter(prefix="/api/operators", tags=["Operator Users"])


# ==================== Pydantic Models ====================

class OperatorUserCreate(BaseModel):
    """Create a new user for an operator"""
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    operator_role: str = "local_user"  # "local_admin" | "local_user"
    scoped_permissions: List[str] = []


class OperatorUserAssign(BaseModel):
    """Assign an existing user to an operator"""
    user_id: str
    operator_role: str = "local_user"  # "local_admin" | "local_user"
    scoped_permissions: List[str] = []


class OperatorUserUpdate(BaseModel):
    """Update a user's role/permissions within an operator"""
    operator_role: Optional[str] = None
    scoped_permissions: Optional[List[str]] = None
    status: Optional[str] = None


# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def verify_operator_access(current_user: dict, operator_id: str, db, require_admin: bool = False):
    """
    Verify that the current user has access to manage users for this operator.
    Returns the operator document if access is granted.
    """
    # Super admins and admins can manage any operator's users
    if current_user["role"] in ["super_admin", "admin"]:
        operator = await db.operators.find_one({"_id": operator_id})
        if not operator:
            raise HTTPException(status_code=404, detail="Operator not found")
        return operator
    
    # Check if user is assigned to this operator with appropriate role
    user_operator_id = current_user.get("operator_id")
    user_operator_role = current_user.get("operator_role")
    
    if user_operator_id != operator_id:
        raise HTTPException(status_code=403, detail="You don't have access to this operator")
    
    if require_admin and user_operator_role not in ["owner", "local_admin"]:
        raise HTTPException(status_code=403, detail="Only operator admins can perform this action")
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    return operator


def can_manage_operator_role(manager_role: str, target_role: str) -> bool:
    """Check if a manager can manage a target operator role"""
    manager_level = OPERATOR_ROLE_HIERARCHY.get(OperatorUserRole(manager_role), 0)
    target_level = OPERATOR_ROLE_HIERARCHY.get(OperatorUserRole(target_role), 0)
    return manager_level > target_level


# ==================== API Endpoints ====================

@router.get("/{operator_id}/users")
async def get_operator_users(
    operator_id: str,
    search: Optional[str] = None,
    operator_role: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get all users assigned to an operator"""
    db = get_database()
    
    # Verify access
    operator = await verify_operator_access(current_user, operator_id, db)
    
    # Build query
    query = {"operator_id": operator_id}
    
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    
    if operator_role:
        query["operator_role"] = operator_role
    
    # Exclude sensitive fields
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
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit,
        "operator": {
            "id": operator["_id"],
            "name": operator["name"],
            "operator_type": operator.get("operator_type")
        }
    }


@router.post("/{operator_id}/users")
async def create_operator_user(
    operator_id: str,
    user_data: OperatorUserCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new user and assign them to an operator"""
    db = get_database()
    
    # Verify access (must be admin or local_admin)
    operator = await verify_operator_access(current_user, operator_id, db, require_admin=True)
    
    # Check if local admin is trying to create another local_admin or owner
    if current_user.get("operator_role") == "local_admin":
        if user_data.operator_role in ["owner", "local_admin"]:
            raise HTTPException(
                status_code=403, 
                detail="Local admins cannot create other admins. Only owners can do this."
            )
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    # Validate operator_role
    if user_data.operator_role not in ["local_admin", "local_user"]:
        raise HTTPException(status_code=400, detail="Invalid operator role. Must be 'local_admin' or 'local_user'")
    
    # Create the user
    new_user = {
        "_id": str(uuid.uuid4()),
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "role": UserRole.OPERATOR.value,  # Platform role is 'operator'
        "status": UserStatus.ACTIVE.value,
        
        # Operator assignment
        "operator_id": operator_id,
        "operator_name": operator["name"],
        "operator_role": user_data.operator_role,
        "operator_type": operator.get("operator_type"),
        "scoped_permissions": user_data.scoped_permissions,
        
        # Metadata
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name", current_user.get("email"))
    }
    
    await db.users.insert_one(new_user)
    
    # Create activity log
    activity = {
        "_id": str(uuid.uuid4()),
        "type": "operator_user_created",
        "operator_id": operator_id,
        "user_id": new_user["_id"],
        "performed_by": current_user["_id"],
        "details": {
            "user_email": user_data.email,
            "operator_role": user_data.operator_role
        },
        "created_at": datetime.now(timezone.utc)
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "User created and assigned to operator successfully",
        "user_id": new_user["_id"],
        "email": user_data.email,
        "operator_role": user_data.operator_role
    }


@router.post("/{operator_id}/users/assign")
async def assign_existing_user(
    operator_id: str,
    assignment: OperatorUserAssign,
    current_user: dict = Depends(get_current_active_user)
):
    """Assign an existing user to an operator"""
    db = get_database()
    
    # Only super_admin and admin can assign existing users to operators
    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Only platform administrators can assign existing users to operators"
        )
    
    # Verify operator exists
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Verify user exists
    user = await db.users.find_one({"_id": assignment.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already assigned to another operator
    if user.get("operator_id") and user.get("operator_id") != operator_id:
        raise HTTPException(
            status_code=400, 
            detail=f"User is already assigned to operator: {user.get('operator_name', 'Unknown')}"
        )
    
    # Validate operator_role
    valid_roles = ["owner", "local_admin", "local_user"]
    if assignment.operator_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid operator role. Must be one of: {valid_roles}")
    
    # Update the user
    update_data = {
        "operator_id": operator_id,
        "operator_name": operator["name"],
        "operator_role": assignment.operator_role,
        "operator_type": operator.get("operator_type"),
        "scoped_permissions": assignment.scoped_permissions,
        "role": UserRole.OPERATOR.value,  # Update platform role to operator
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.users.update_one({"_id": assignment.user_id}, {"$set": update_data})
    
    # Create activity log
    activity = {
        "_id": str(uuid.uuid4()),
        "type": "operator_user_assigned",
        "operator_id": operator_id,
        "user_id": assignment.user_id,
        "performed_by": current_user["_id"],
        "details": {
            "user_email": user.get("email"),
            "operator_role": assignment.operator_role
        },
        "created_at": datetime.now(timezone.utc)
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "User assigned to operator successfully",
        "user_id": assignment.user_id,
        "operator_id": operator_id,
        "operator_role": assignment.operator_role
    }


@router.put("/{operator_id}/users/{user_id}")
async def update_operator_user(
    operator_id: str,
    user_id: str,
    update_data: OperatorUserUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a user's role/permissions within an operator"""
    db = get_database()
    
    # Verify access
    operator = await verify_operator_access(current_user, operator_id, db, require_admin=True)
    
    # Get the target user
    target_user = await db.users.find_one({"_id": user_id, "operator_id": operator_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in this operator")
    
    # Cannot modify owner unless you're super_admin
    if target_user.get("operator_role") == "owner" and current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify operator owner")
    
    # Local admins cannot promote users to local_admin or owner
    if current_user.get("operator_role") == "local_admin":
        if update_data.operator_role in ["owner", "local_admin"]:
            raise HTTPException(
                status_code=403, 
                detail="Local admins cannot promote users to admin level"
            )
    
    # Build update
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    
    if update_data.operator_role:
        if update_data.operator_role not in ["owner", "local_admin", "local_user"]:
            raise HTTPException(status_code=400, detail="Invalid operator role")
        update_fields["operator_role"] = update_data.operator_role
    
    if update_data.scoped_permissions is not None:
        update_fields["scoped_permissions"] = update_data.scoped_permissions
    
    if update_data.status:
        if update_data.status not in ["active", "inactive", "suspended"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        update_fields["status"] = update_data.status
    
    await db.users.update_one({"_id": user_id}, {"$set": update_fields})
    
    return {"message": "User updated successfully", "user_id": user_id}


@router.delete("/{operator_id}/users/{user_id}")
async def remove_operator_user(
    operator_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Remove a user from an operator (unassign, not delete)"""
    db = get_database()
    
    # Verify access
    operator = await verify_operator_access(current_user, operator_id, db, require_admin=True)
    
    # Get the target user
    target_user = await db.users.find_one({"_id": user_id, "operator_id": operator_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in this operator")
    
    # Cannot remove owner unless you're super_admin
    if target_user.get("operator_role") == "owner":
        if current_user["role"] != "super_admin":
            raise HTTPException(status_code=403, detail="Cannot remove operator owner")
    
    # Local admins cannot remove other local_admins
    if current_user.get("operator_role") == "local_admin":
        if target_user.get("operator_role") == "local_admin":
            raise HTTPException(
                status_code=403, 
                detail="Local admins cannot remove other local admins"
            )
    
    # Cannot remove yourself
    if current_user["_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the operator")
    
    # Unassign user from operator (set fields to None, change role back to customer)
    update_fields = {
        "operator_id": None,
        "operator_name": None,
        "operator_role": None,
        "operator_type": None,
        "scoped_permissions": [],
        "role": UserRole.CUSTOMER.value,  # Revert to customer role
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.users.update_one({"_id": user_id}, {"$set": update_fields})
    
    # Create activity log
    activity = {
        "_id": str(uuid.uuid4()),
        "type": "operator_user_removed",
        "operator_id": operator_id,
        "user_id": user_id,
        "performed_by": current_user["_id"],
        "details": {
            "user_email": target_user.get("email"),
            "previous_role": target_user.get("operator_role")
        },
        "created_at": datetime.now(timezone.utc)
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "User removed from operator successfully", "user_id": user_id}


@router.get("/{operator_id}/users/available")
async def get_available_users(
    operator_id: str,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(require_permission("operators.edit"))
):
    """Get users that can be assigned to this operator (not already assigned to any operator)"""
    db = get_database()
    
    # Verify operator exists
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Query for users without operator assignment
    query = {
        "$or": [
            {"operator_id": None},
            {"operator_id": {"$exists": False}}
        ],
        "role": {"$nin": ["super_admin", "admin"]}  # Exclude platform admins
    }
    
    if search:
        query["$and"] = [
            query.pop("$or"),  # Move the operator_id condition to $and
            {"$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"full_name": {"$regex": search, "$options": "i"}}
            ]}
        ]
        query["$or"] = [
            {"operator_id": None},
            {"operator_id": {"$exists": False}}
        ]
    
    projection = {
        "password_hash": 0,
        "two_fa_secret": 0,
        "email_verification_token": 0,
        "password_reset_token": 0
    }
    
    users = await db.users.find(query, projection).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    for user in users:
        user["id"] = str(user.pop("_id", ""))
    
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@router.get("/{operator_id}/stats")
async def get_operator_user_stats(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get statistics about users in an operator"""
    db = get_database()
    
    # Verify access
    operator = await verify_operator_access(current_user, operator_id, db)
    
    # Get counts by role
    pipeline = [
        {"$match": {"operator_id": operator_id}},
        {"$group": {"_id": "$operator_role", "count": {"$sum": 1}}}
    ]
    
    role_counts = await db.users.aggregate(pipeline).to_list(10)
    
    # Get total count
    total_users = await db.users.count_documents({"operator_id": operator_id})
    
    # Get active count
    active_users = await db.users.count_documents({
        "operator_id": operator_id,
        "status": "active"
    })
    
    # Format response
    by_role = {item["_id"]: item["count"] for item in role_counts if item["_id"]}
    
    return {
        "operator_id": operator_id,
        "operator_name": operator["name"],
        "total_users": total_users,
        "active_users": active_users,
        "by_role": {
            "owner": by_role.get("owner", 0),
            "local_admin": by_role.get("local_admin", 0),
            "local_user": by_role.get("local_user", 0)
        }
    }
