"""
Comprehensive Permission System for Oryno Platform
Defines global and operator-scoped permissions with role inheritance
"""
from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel

# ==================== GLOBAL PERMISSIONS ====================
# These are platform-level permissions for super_admin and admin roles

GLOBAL_PERMISSIONS = {
    # Operator Management
    "operators.view": "View all operators",
    "operators.create": "Create new operators",
    "operators.edit": "Edit operator details",
    "operators.delete": "Delete operators",
    "operators.suspend": "Suspend/activate operators",
    
    # User Management (Platform Level)
    "users.view": "View all platform users",
    "users.create": "Create platform users",
    "users.edit": "Edit user details",
    "users.delete": "Delete users",
    "users.roles": "Manage user roles",
    
    # Bookings (Global View)
    "bookings.view_all": "View all bookings across platform",
    "bookings.manage_all": "Manage any booking",
    "bookings.refund": "Process refunds",
    
    # Reports (Global)
    "reports.view_all": "View all platform reports",
    "reports.export": "Export reports",
    "reports.analytics": "Access analytics dashboard",
    
    # Settings (Global)
    "settings.view": "View platform settings",
    "settings.manage": "Manage platform settings",
    "settings.billing": "Manage billing settings",
    
    # Services (Global Management)
    "services.hotels.manage_all": "Manage all hotels",
    "services.travel.manage_all": "Manage all travel routes",
    "services.restaurants.manage_all": "Manage all restaurants",
    "services.car_rental.manage_all": "Manage all car rentals",
    "services.events.manage_all": "Manage all events",
    "services.laundry.manage_all": "Manage all laundry services",
    "services.banquet.manage_all": "Manage all banquet halls",
    "services.cinema.manage_all": "Manage all cinemas",
    "services.packages.manage_all": "Manage all packages",
}

# ==================== OPERATOR PERMISSIONS ====================
# These are operator-scoped permissions that can be delegated

OPERATOR_PERMISSIONS = {
    # Service Management (Operator's Own Services)
    "operator.services.view": "View operator's services",
    "operator.services.create": "Create new services",
    "operator.services.edit": "Edit existing services",
    "operator.services.delete": "Delete services",
    "operator.services.pricing": "Manage service pricing",
    "operator.services.availability": "Manage availability/inventory",
    
    # Bookings (Operator's Bookings)
    "operator.bookings.view": "View operator's bookings",
    "operator.bookings.create": "Create manual bookings",
    "operator.bookings.edit": "Edit bookings",
    "operator.bookings.cancel": "Cancel bookings",
    "operator.bookings.confirm": "Confirm pending bookings",
    "operator.bookings.checkin": "Process check-ins",
    
    # Team Management
    "operator.team.view": "View team members",
    "operator.team.create": "Add team members",
    "operator.team.edit": "Edit team member details",
    "operator.team.remove": "Remove team members",
    "operator.team.roles": "Manage team roles",
    
    # Roles & Permissions
    "operator.roles.view": "View custom roles",
    "operator.roles.create": "Create custom roles",
    "operator.roles.edit": "Edit custom roles",
    "operator.roles.delete": "Delete custom roles",
    "operator.roles.assign": "Assign roles to users",
    
    # Reports (Operator's Data)
    "operator.reports.view": "View operator reports",
    "operator.reports.export": "Export operator reports",
    "operator.reports.analytics": "View analytics dashboard",
    
    # Communications
    "operator.communications.view": "View communications",
    "operator.communications.send": "Send announcements",
    "operator.communications.alerts": "Manage alerts",
    
    # Settings (Operator Level)
    "operator.settings.view": "View operator settings",
    "operator.settings.edit": "Edit operator settings",
    "operator.settings.notifications": "Manage notification preferences",
    
    # Customer Management
    "operator.customers.view": "View customer information",
    "operator.customers.contact": "Contact customers",
    "operator.customers.notes": "Add customer notes",
}

# ==================== DEFAULT ROLE TEMPLATES ====================

DEFAULT_OPERATOR_ROLES = {
    "owner": {
        "name": "Owner",
        "description": "Full control over operator account",
        "is_system": True,
        "can_be_deleted": False,
        "permissions": list(OPERATOR_PERMISSIONS.keys()),  # All operator permissions
    },
    "local_admin": {
        "name": "Local Admin",
        "description": "Administrative access to operator account",
        "is_system": True,
        "can_be_deleted": False,
        "permissions": [
            "operator.services.view",
            "operator.services.create",
            "operator.services.edit",
            "operator.services.pricing",
            "operator.services.availability",
            "operator.bookings.view",
            "operator.bookings.create",
            "operator.bookings.edit",
            "operator.bookings.confirm",
            "operator.bookings.checkin",
            "operator.team.view",
            "operator.team.create",
            "operator.team.edit",
            "operator.roles.view",
            "operator.roles.assign",
            "operator.reports.view",
            "operator.reports.export",
            "operator.communications.view",
            "operator.communications.send",
            "operator.settings.view",
            "operator.customers.view",
            "operator.customers.contact",
            "operator.customers.notes",
        ],
    },
    "local_user": {
        "name": "Local User",
        "description": "Basic access to operator account",
        "is_system": True,
        "can_be_deleted": False,
        "permissions": [
            "operator.services.view",
            "operator.bookings.view",
            "operator.bookings.confirm",
            "operator.bookings.checkin",
            "operator.team.view",
            "operator.reports.view",
            "operator.communications.view",
            "operator.customers.view",
        ],
    },
}

# ==================== SERVICE TYPE MAPPINGS ====================

SERVICE_TYPES = {
    "hotels": {
        "label": "Hotels",
        "icon": "Hotel",
        "route": "/management/hotels",
        "api_prefix": "/hotels",
    },
    "travel": {
        "label": "Travel",
        "icon": "Bus",
        "route": "/management/travel",
        "api_prefix": "/travel-routes",
    },
    "restaurants": {
        "label": "Restaurants",
        "icon": "Utensils",
        "route": "/management/restaurants",
        "api_prefix": "/restaurants",
    },
    "car_rental": {
        "label": "Car Rental",
        "icon": "Car",
        "route": "/management/car-rental",
        "api_prefix": "/vehicles",
    },
    "events": {
        "label": "Events",
        "icon": "Calendar",
        "route": "/management/events",
        "api_prefix": "/events",
    },
    "pressing": {
        "label": "Laundry",
        "icon": "Shirt",
        "route": "/management/laundry",
        "api_prefix": "/pressing",
    },
    "banquets": {
        "label": "Banquet",
        "icon": "UtensilsCrossed",
        "route": "/management/banquet",
        "api_prefix": "/banquets",
    },
    "cinema": {
        "label": "Cinema",
        "icon": "Film",
        "route": "/management/cinema",
        "api_prefix": "/cinemas",
    },
    "packages": {
        "label": "Packages",
        "icon": "Package",
        "route": "/management/packages",
        "api_prefix": "/packages",
    },
}

# ==================== ROLE HIERARCHY ====================

PLATFORM_ROLE_HIERARCHY = {
    "customer": 0,
    "employee": 1,
    "service_provider": 2,
    "operator": 3,
    "admin": 4,
    "super_admin": 5,
}

OPERATOR_ROLE_HIERARCHY = {
    "local_user": 0,
    "local_admin": 1,
    "owner": 2,
}

# ==================== PERMISSION HELPER FUNCTIONS ====================

def get_role_permissions(platform_role: str, operator_role: str = None) -> List[str]:
    """Get all permissions for a user based on their platform and operator roles"""
    permissions = []
    
    # Super admin and admin get global permissions
    if platform_role == "super_admin":
        permissions.extend(GLOBAL_PERMISSIONS.keys())
        permissions.extend(OPERATOR_PERMISSIONS.keys())
    elif platform_role == "admin":
        # Admins get most global permissions except critical ones
        admin_permissions = [p for p in GLOBAL_PERMISSIONS.keys() 
                           if not p.startswith("settings.") or p == "settings.view"]
        permissions.extend(admin_permissions)
    
    # Operator users get operator-scoped permissions based on their operator role
    if platform_role == "operator" and operator_role:
        role_template = DEFAULT_OPERATOR_ROLES.get(operator_role, {})
        permissions.extend(role_template.get("permissions", []))
    
    return list(set(permissions))


def has_permission(user_permissions: List[str], required_permission: str) -> bool:
    """Check if user has a specific permission"""
    return required_permission in user_permissions


def can_delegate_permission(delegator_permissions: List[str], permission: str) -> bool:
    """Check if a user can delegate a specific permission"""
    # User can only delegate permissions they have
    return permission in delegator_permissions


def get_delegatable_permissions(user_permissions: List[str]) -> List[str]:
    """Get list of permissions a user can delegate to others"""
    # Filter to only operator permissions (global permissions can't be delegated)
    return [p for p in user_permissions if p.startswith("operator.")]


# ==================== PYDANTIC MODELS ====================

class OperatorRole(BaseModel):
    """Custom role within an operator"""
    id: Optional[str] = None
    operator_id: str
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    is_system: bool = False
    can_be_deleted: bool = True
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PermissionGrant(BaseModel):
    """Individual permission grant to a user"""
    permission: str
    granted_by: str
    granted_at: str
    expires_at: Optional[str] = None
