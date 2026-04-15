"""
Permission Checking Utilities
Provides functions to check user permissions based on assigned roles and custom permissions
"""
from functools import wraps
from fastapi import HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from typing import List, Optional, Callable
import logging

logger = logging.getLogger(__name__)

# Complete permission codes mapping - ALL permissions must have corresponding API enforcement
PERMISSION_MODULES = {
    # ==================== HOTELS ====================
    "hotels.view": "hotels",
    "hotels.create": "hotels",
    "hotels.edit": "hotels",
    "hotels.delete": "hotels",
    "hotels.manage_rooms": "hotels",
    "hotels.view_bookings": "hotels",
    "hotels.manage_bookings": "hotels",
    
    # ==================== ROOMS ====================
    "rooms.view": "rooms",
    "rooms.create": "rooms",
    "rooms.edit": "rooms",
    "rooms.delete": "rooms",
    "rooms.manage_availability": "rooms",
    
    # ==================== CAR RENTALS ====================
    "car_rental.view": "car_rental",
    "car_rental.create": "car_rental",
    "car_rental.edit": "car_rental",
    "car_rental.delete": "car_rental",
    "car_rental.view_bookings": "car_rental",
    "car_rental.manage_bookings": "car_rental",
    
    # ==================== EVENTS ====================
    "events.view": "events",
    "events.create": "events",
    "events.edit": "events",
    "events.delete": "events",
    "events.view_bookings": "events",
    "events.manage_tickets": "events",
    
    # ==================== TRAVEL ====================
    "travel.view": "travel",
    "travel.create": "travel",
    "travel.edit": "travel",
    "travel.delete": "travel",
    "travel.view_bookings": "travel",
    "travel.manage_bookings": "travel",
    "travel.manage_routes": "travel",
    "travel.manage_schedules": "travel",
    
    # ==================== USERS ====================
    "users.view": "users",
    "users.create": "users",
    "users.edit": "users",
    "users.delete": "users",
    "users.manage_roles": "users",
    "users.assign_permissions": "users",
    "users.view_activity": "users",
    
    # ==================== OPERATORS ====================
    "operators.view": "operators",
    "operators.create": "operators",
    "operators.edit": "operators",
    "operators.delete": "operators",
    "operators.approve": "operators",
    "operators.manage_services": "operators",
    "operators.view_reports": "operators",
    
    # ==================== EMPLOYEES ====================
    "employees.view": "employees",
    "employees.create": "employees",
    "employees.edit": "employees",
    "employees.delete": "employees",
    "employees.manage_schedules": "employees",
    
    # ==================== ANALYTICS & REPORTS ====================
    "analytics.view": "analytics",
    "analytics.view_dashboard": "analytics",
    "analytics.view_revenue": "analytics",
    "analytics.view_bookings": "analytics",
    "analytics.view_customers": "analytics",
    "analytics.export": "analytics",
    "reports.view": "reports",
    "reports.generate": "reports",
    "reports.export": "reports",
    
    # ==================== PAYMENTS & FINANCE ====================
    "payments.view": "payments",
    "payments.view_transactions": "payments",
    "payments.process": "payments",
    "payments.refund": "payments",
    "payments.view_reports": "payments",
    "commission.view": "commission",
    "commission.edit": "commission",
    "commission.process_payouts": "commission",
    
    # ==================== SETTINGS ====================
    "settings.view": "settings",
    "settings.edit": "settings",
    "settings.manage_integrations": "settings",
    "settings.manage_notifications": "settings",
    "settings.manage_branding": "settings",
    
    # ==================== ACCESS CONTROL ====================
    "access.view_roles": "access",
    "access.create_roles": "access",
    "access.edit_roles": "access",
    "access.delete_roles": "access",
    "access.assign_roles": "access",
    "access.view_permissions": "access",
    "access.manage_permissions": "access",
    
    # ==================== PROMO CODES ====================
    "promo.view": "promo",
    "promo.create": "promo",
    "promo.edit": "promo",
    "promo.delete": "promo",
    
    # ==================== LOYALTY ====================
    "loyalty.view": "loyalty",
    "loyalty.manage_programs": "loyalty",
    "loyalty.manage_rewards": "loyalty",
    "loyalty.adjust_points": "loyalty",
    
    # ==================== SUPPORT ====================
    "support.view_tickets": "support",
    "support.manage_tickets": "support",
    "support.view_chat": "support",
    "support.respond_chat": "support",
    
    # ==================== NOTIFICATIONS ====================
    "notifications.view": "notifications",
    "notifications.send": "notifications",
    "notifications.manage_templates": "notifications",
    
    # ==================== CINEMA ====================
    "cinema.view": "cinema",
    "cinema.create": "cinema",
    "cinema.edit": "cinema",
    "cinema.delete": "cinema",
    "cinema.manage_screenings": "cinema",
    "cinema.manage_seats": "cinema",
    
    # ==================== RESTAURANTS ====================
    "restaurants.view": "restaurants",
    "restaurants.create": "restaurants",
    "restaurants.edit": "restaurants",
    "restaurants.delete": "restaurants",
    "restaurants.manage_menu": "restaurants",
    "restaurants.manage_reservations": "restaurants",
    
    # ==================== BANQUETS ====================
    "banquets.view": "banquets",
    "banquets.create": "banquets",
    "banquets.edit": "banquets",
    "banquets.delete": "banquets",
    "banquets.manage_bookings": "banquets",
    
    # ==================== PRESSING/LAUNDRY ====================
    "pressing.view": "pressing",
    "pressing.create": "pressing",
    "pressing.edit": "pressing",
    "pressing.delete": "pressing",
    "pressing.manage_orders": "pressing",
    
    # ==================== PACKAGES ====================
    "packages.view": "packages",
    "packages.create": "packages",
    "packages.edit": "packages",
    "packages.delete": "packages",
    
    # ==================== ORDERS ====================
    "orders.view": "orders",
    "orders.view_all": "orders",
    "orders.edit": "orders",
    "orders.cancel": "orders",
    "orders.process": "orders",
    
    # ==================== VALIDATION ====================
    "validation.view": "validation",
    "validation.approve": "validation",
    "validation.reject": "validation",
    
    # ==================== ACTIVITY LOGS ====================
    "activity.view": "activity",
    "activity.export": "activity",
}

# ONLY super_admin bypasses permission checks - admins are tied to permissions
SUPER_ADMIN_ROLE = "super_admin"


async def get_user_effective_permissions(user_id: str, db) -> set:
    """
    Get all effective permissions for a user by combining:
    1. Default permissions based on role
    2. Custom permissions directly assigned to the user
    3. Permissions from all assigned roles
    
    Returns a set of permission codes
    """
    permissions = set()
    
    # Get user data
    user = await db.users.find_one(
        {"$or": [{"_id": user_id}, {"id": user_id}]},
        {"custom_permissions": 1, "assigned_roles": 1, "role": 1}
    )
    
    if not user:
        return permissions
    
    user_role = user.get("role")
    
    # ONLY super_admin has all permissions
    if user_role == SUPER_ADMIN_ROLE:
        return {"*"}  # Wildcard means all permissions
    
    # Default permissions for admin role
    if user_role == "admin":
        admin_default_perms = [
            "users.view", "users.create", "users.edit", "users.delete",
            "users.manage_roles", "users.view_activity",
            "operators.view", "operators.create", "operators.edit",
            "orders.view", "orders.view_all", "orders.edit", "orders.cancel", "orders.process",
            "receipts.view",
            "loyalty.view",  # Read-only for admin
            "ratings.view", "ratings.manage",
            "support.view_tickets", "support.manage_tickets",
            "activity.view",
            "validation.view", "validation.approve", "validation.reject",
            "analytics.view_dashboard",
            "employees.view", "employees.create", "employees.edit", "employees.delete",
            "promo.view", "promo.create", "promo.edit",
            # Role management - limited (can create custom roles, not system roles)
            "access.view_roles", "access.create_roles", "access.edit_roles",
            "access.assign_roles",
            # Service management permissions
            "hotels.view", "hotels.create", "hotels.edit", "hotels.delete", "hotels.manage_rooms",
            "travel.view", "travel.create", "travel.edit", "travel.delete",
            "car_rental.view", "car_rental.create", "car_rental.edit", "car_rental.delete",
            "restaurants.view", "restaurants.create", "restaurants.edit", "restaurants.delete",
            "restaurants.manage_menu", "restaurants.manage_reservations",
            "events.view", "events.create", "events.edit", "events.delete",
            "pressing.view", "pressing.create", "pressing.edit", "pressing.delete",
            "banquets.view", "banquets.create", "banquets.edit", "banquets.delete",
            "cinema.view", "cinema.create", "cinema.edit", "cinema.delete",
            "cinema.manage_screenings",
            "packages.view", "packages.create", "packages.edit", "packages.delete",
            # Pod and scope management
            "pods.view", "pods.create", "pods.edit", "pods.delete",
            "pods.manage_members", "pods.manage_operators",
            "employee_scopes.view", "employee_scopes.create", "employee_scopes.edit",
            "employee_scopes.delete", "employee_scopes.assign",
            "geography.view", "geography.create", "geography.edit", "geography.delete",
        ]
        permissions.update(admin_default_perms)
    
    # Default permissions for operator role
    if user_role == "operator":
        operator_default_perms = [
            "orders.view",
            "receipts.view",
            "ratings.view",
            "activity.view",
            "analytics.view_dashboard",
            "promo.view", "promo.create", "promo.edit", "promo.delete",
            "support.view_tickets",
        ]
        permissions.update(operator_default_perms)
    
    # Add custom permissions directly assigned to user
    custom_perms = user.get("custom_permissions", [])
    if custom_perms:
        permissions.update(custom_perms)
    
    # Get permissions from assigned roles
    assigned_roles = user.get("assigned_roles", [])
    if assigned_roles:
        # Fetch all assigned roles
        roles = await db.roles.find(
            {"$or": [{"id": {"$in": assigned_roles}}, {"name": {"$in": assigned_roles}}]}
        ).to_list(100)
        
        for role in roles:
            role_perms = role.get("permissions", [])
            permissions.update(role_perms)
    
    return permissions


async def check_user_permission(user: dict, required_permission: str, db) -> bool:
    """
    Check if a user has a specific permission
    
    Args:
        user: The user dict from the database
        required_permission: The permission code to check (e.g., "hotels.create")
        db: Database instance
    
    Returns:
        True if user has the permission, False otherwise
    """
    user_role = user.get("role", "")
    
    # ONLY super_admin bypasses all permission checks
    if user_role == SUPER_ADMIN_ROLE:
        return True
    
    user_id = user.get("_id") or user.get("id")
    permissions = await get_user_effective_permissions(user_id, db)
    
    # Wildcard means all permissions
    if "*" in permissions:
        return True
    
    # Check exact match
    if required_permission in permissions:
        return True
    
    # Check module-level permission (e.g., "hotels.*" grants all hotels permissions)
    module = PERMISSION_MODULES.get(required_permission, required_permission.split(".")[0])
    if f"{module}.*" in permissions:
        return True
    
    return False


async def check_user_permissions(user: dict, required_permissions: List[str], db, require_all: bool = False) -> bool:
    """
    Check if a user has required permissions
    
    Args:
        user: The user dict from the database
        required_permissions: List of permission codes to check
        db: Database instance
        require_all: If True, user must have ALL permissions. If False, user needs at least ONE.
    
    Returns:
        True if permission check passes, False otherwise
    """
    user_role = user.get("role", "")
    
    # ONLY super_admin bypasses all permission checks
    if user_role == SUPER_ADMIN_ROLE:
        return True
    
    user_id = user.get("_id") or user.get("id")
    user_permissions = await get_user_effective_permissions(user_id, db)
    
    # Wildcard means all permissions
    if "*" in user_permissions:
        return True
    
    if require_all:
        # User must have ALL required permissions
        for perm in required_permissions:
            if perm not in user_permissions:
                module = PERMISSION_MODULES.get(perm, perm.split(".")[0])
                if f"{module}.*" not in user_permissions:
                    return False
        return True
    else:
        # User needs at least ONE of the permissions
        for perm in required_permissions:
            if perm in user_permissions:
                return True
            module = PERMISSION_MODULES.get(perm, perm.split(".")[0])
            if f"{module}.*" in user_permissions:
                return True
        return False


async def _log_permission_denial(db, user: dict, required_permissions, request_path: str = ""):
    """Log a permission denial to the permission_audit_trail collection"""
    from datetime import datetime, timezone
    try:
        await db.permission_audit_trail.insert_one({
            "user_id": user.get("_id") or user.get("id"),
            "user_email": user.get("email"),
            "user_role": user.get("role"),
            "required_permissions": required_permissions if isinstance(required_permissions, list) else [required_permissions],
            "action": "denied",
            "request_path": request_path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass  # Don't let audit logging break the request flow


def require_permission(permission_code: str):
    """
    Dependency factory to check if user has a specific permission
    
    Usage:
        @router.post("/hotels/")
        async def create_hotel(
            current_user: dict = Depends(require_permission("hotels.create"))
        ):
            ...
    """
    async def permission_checker(current_user: dict = Depends(get_current_active_user)):
        db = get_database()
        has_perm = await check_user_permission(current_user, permission_code, db)
        
        if not has_perm:
            logger.warning(
                f"Permission denied: User {current_user.get('email')} (role: {current_user.get('role')}) "
                f"attempted action requiring '{permission_code}'"
            )
            await _log_permission_denial(db, current_user, permission_code)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {permission_code}"
            )
        
        return current_user
    
    return permission_checker


def require_any_permission(permission_codes: List[str]):
    """
    Dependency factory to check if user has ANY of the specified permissions
    """
    async def permission_checker(current_user: dict = Depends(get_current_active_user)):
        db = get_database()
        has_perm = await check_user_permissions(current_user, permission_codes, db, require_all=False)
        
        if not has_perm:
            logger.warning(
                f"Permission denied: User {current_user.get('email')} (role: {current_user.get('role')}) "
                f"attempted action requiring one of: {permission_codes}"
            )
            await _log_permission_denial(db, current_user, permission_codes)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required one of: {', '.join(permission_codes)}"
            )
        
        return current_user
    
    return permission_checker


def require_all_permissions(permission_codes: List[str]):
    """
    Dependency factory to check if user has ALL of the specified permissions
    """
    async def permission_checker(current_user: dict = Depends(get_current_active_user)):
        db = get_database()
        has_perm = await check_user_permissions(current_user, permission_codes, db, require_all=True)
        
        if not has_perm:
            logger.warning(
                f"Permission denied: User {current_user.get('email')} (role: {current_user.get('role')}) "
                f"attempted action requiring all of: {permission_codes}"
            )
            await _log_permission_denial(db, current_user, permission_codes)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required all of: {', '.join(permission_codes)}"
            )
        
        return current_user
    
    return permission_checker


def require_super_admin():
    """
    Dependency that requires super_admin role only
    """
    async def super_admin_checker(current_user: dict = Depends(get_current_active_user)):
        if current_user.get("role") != SUPER_ADMIN_ROLE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action requires super admin privileges"
            )
        return current_user
    
    return super_admin_checker


# Export all available permissions for the frontend
def get_all_permissions():
    """Get all available permission codes grouped by module"""
    permissions_by_module = {}
    for perm_code, module in PERMISSION_MODULES.items():
        if module not in permissions_by_module:
            permissions_by_module[module] = []
        permissions_by_module[module].append(perm_code)
    return permissions_by_module
