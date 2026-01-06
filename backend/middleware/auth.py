from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.auth import decode_token
from config.database import get_database
from typing import Optional, List

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if token is access token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Inject operator context if user is assigned to an operator
    if user.get("operator_id"):
        operator = await db.operators.find_one({"_id": user["operator_id"]})
        if operator:
            user["_operator_context"] = {
                "operator_id": operator["_id"],
                "operator_name": operator.get("name"),
                "operator_type": operator.get("operator_type"),
                "service_types": operator.get("service_types", []),
                "status": operator.get("status"),
            }
        
        # Calculate effective permissions
        user["_effective_permissions"] = await calculate_effective_permissions(user, db)
    else:
        user["_operator_context"] = None
        user["_effective_permissions"] = await calculate_effective_permissions(user, db)
    
    return user


async def calculate_effective_permissions(user: dict, db) -> List[str]:
    """Calculate all effective permissions for a user based on their roles"""
    from utils.permissions_config import get_role_permissions, OPERATOR_PERMISSIONS
    
    permissions = []
    platform_role = user.get("role", "customer")
    operator_role = user.get("operator_role")
    
    # Super admin gets all permissions
    if platform_role == "super_admin":
        return ["*"]  # Wildcard means all permissions
    
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


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """Get current active user"""
    if current_user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    return current_user


async def require_role(required_roles: list):
    """Dependency to check user role"""
    async def role_checker(current_user: dict = Depends(get_current_active_user)):
        user_role = current_user.get("role")
        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


def require_operator_access(service_type: Optional[str] = None):
    """
    Dependency to ensure user has access to operator-scoped data.
    Optionally filter by service type.
    """
    async def operator_checker(current_user: dict = Depends(get_current_active_user)):
        # Super admin and admin bypass operator checks
        if current_user.get("role") in ["super_admin", "admin"]:
            return current_user
        
        # Operator users must have an operator_id
        if not current_user.get("operator_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not assigned to any operator."
            )
        
        # Check service type if specified
        if service_type:
            op_context = current_user.get("_operator_context", {})
            op_type = op_context.get("operator_type")
            service_types = op_context.get("service_types", [])
            
            # Check if operator handles this service type
            if op_type != service_type and service_type not in service_types:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your operator does not manage {service_type} services"
                )
        
        return current_user
    
    return operator_checker


def get_operator_filter(current_user: dict) -> dict:
    """
    Returns a MongoDB filter to scope queries to the user's operator.
    Returns empty dict for super_admin/admin (no filter needed).
    """
    if current_user.get("role") in ["super_admin", "admin"]:
        return {}
    
    operator_id = current_user.get("operator_id")
    if not operator_id:
        # User not assigned to operator - return filter that matches nothing
        return {"operator_id": "__no_access__"}
    
    return {"operator_id": operator_id}