"""
Advanced Authorization Service
Implements attribute-based access control with pod-based isolation
"""
from typing import Optional, Dict, List, Set
from datetime import datetime
from config.database import get_database


class AuthorizationContext:
    """
    Authorization context containing all evaluated access information.
    Used throughout the request lifecycle.
    """
    
    def __init__(self, user: Dict):
        self.user = user
        self.user_id = str(user.get("_id") or user.get("id"))
        self.user_type = self._determine_user_type()
        
        # Evaluated context
        self.pod_membership: Optional[Dict] = None
        self.access_scopes: List[Dict] = []
        self.operator_context: Optional[Dict] = None
        self.location_context: Optional[Dict] = None
        
        # Computed access
        self.accessible_operator_ids: Set[str] = set()
        self.has_global_access: bool = False
    
    def _determine_user_type(self) -> str:
        """
        Determine user type based on role and assignments.
        Returns: super_admin, platform_employee, operator_owner, operator_employee, customer
        """
        role = self.user.get("role", "customer")
        
        if role == "super_admin":
            return "super_admin"
        
        if role == "admin":
            # Admins are platform employees with scoped access
            return "platform_employee"
        
        if role == "operator":
            operator_role = self.user.get("operator_role")
            if operator_role == "owner":
                return "operator_owner"
            else:
                return "operator_employee"
        
        return "customer"
    
    @property
    def is_super_admin(self) -> bool:
        return self.user_type == "super_admin"
    
    @property
    def is_platform_employee(self) -> bool:
        return self.user_type == "platform_employee"
    
    @property
    def is_operator(self) -> bool:
        return self.user_type in ("operator_owner", "operator_employee")
    
    @property
    def is_customer(self) -> bool:
        return self.user_type == "customer"


async def build_authorization_context(user: Dict, db=None) -> AuthorizationContext:
    """
    Build a complete authorization context for a user.
    This is called during authentication and cached in the request.
    """
    if db is None:
        db = get_database()
    
    context = AuthorizationContext(user)
    
    # Super admin bypasses all checks
    if context.is_super_admin:
        context.has_global_access = True
        return context
    
    # Platform Employee: Resolve pod membership and access scopes
    if context.is_platform_employee:
        await _resolve_employee_access(context, db)
    
    # Operator: Resolve operator context
    elif context.is_operator:
        await _resolve_operator_access(context, db)
    
    # Customer: Location context is resolved separately per request
    
    return context


async def _resolve_employee_access(context: AuthorizationContext, db) -> None:
    """
    Resolve platform employee's access through pods and scopes.
    """
    user_id = context.user_id
    
    # 1. Check pod membership (one employee = one pod)
    pod_membership = await db.pod_memberships.find_one({
        "user_id": user_id,
        "is_active": True
    })
    
    if pod_membership:
        context.pod_membership = pod_membership
        
        # Get pod's assigned operators
        pod = await db.pods.find_one({"id": pod_membership["pod_id"]})
        if pod and pod.get("assigned_operator_ids"):
            context.accessible_operator_ids.update(pod["assigned_operator_ids"])
    
    # 2. Get assigned access scopes
    scope_assignments = await db.employee_scope_assignments.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(100)
    
    if scope_assignments:
        scope_ids = [a["scope_id"] for a in scope_assignments]
        scopes = await db.employee_access_scopes.find({
            "id": {"$in": scope_ids},
            "is_active": True
        }).to_list(100)
        
        context.access_scopes = scopes
        
        # Resolve operators matching scopes
        accessible_ids = await _resolve_operators_from_scopes(scopes, db)
        context.accessible_operator_ids.update(accessible_ids)
    
    # 3. Check for global access (empty scopes = wildcard)
    if context.access_scopes:
        for scope in context.access_scopes:
            if _is_wildcard_scope(scope):
                context.has_global_access = True
                break


async def _resolve_operator_access(context: AuthorizationContext, db) -> None:
    """
    Resolve operator user's access to their own operator entity.
    """
    operator_id = context.user.get("operator_id")
    
    if operator_id:
        operator = await db.operators.find_one({"_id": operator_id})
        if operator:
            context.operator_context = {
                "operator_id": operator["_id"],
                "operator_name": operator.get("name"),
                "operator_type": operator.get("operator_type"),
                "service_types": operator.get("service_types", []),
                "country": operator.get("country"),
                "region": operator.get("region"),
                "market_segment": operator.get("market_segment"),
            }
            # Operator users can only access their own operator
            context.accessible_operator_ids.add(operator_id)


async def _resolve_operators_from_scopes(scopes: List[Dict], db) -> Set[str]:
    """
    Resolve which operator IDs are accessible based on access scopes.
    Multiple scopes are combined with OR logic.
    """
    accessible_ids: Set[str] = set()
    
    for scope in scopes:
        # If specific operators are set, use those directly
        if scope.get("specific_operator_ids"):
            accessible_ids.update(scope["specific_operator_ids"])
            continue
        
        # Build query from scope attributes (AND logic within scope)
        query = {"status": "active"}
        
        if scope.get("countries"):
            query["country"] = {"$in": [c.upper() for c in scope["countries"]]}
        
        if scope.get("regions"):
            query["region"] = {"$in": scope["regions"]}
        
        if scope.get("market_segments"):
            query["market_segment"] = {"$in": scope["market_segments"]}
        
        if scope.get("service_types"):
            query["$or"] = [
                {"operator_type": {"$in": scope["service_types"]}},
                {"service_types": {"$in": scope["service_types"]}}
            ]
        
        # Query operators matching this scope
        matching_operators = await db.operators.find(
            query,
            {"_id": 1}
        ).to_list(10000)
        
        for op in matching_operators:
            accessible_ids.add(op["_id"])
    
    return accessible_ids


def _is_wildcard_scope(scope: Dict) -> bool:
    """
    Check if a scope is effectively a wildcard (all empty filters).
    """
    return (
        not scope.get("countries") and
        not scope.get("regions") and
        not scope.get("market_segments") and
        not scope.get("service_types") and
        not scope.get("specific_operator_ids")
    )


def get_operator_access_filter(context: AuthorizationContext) -> Dict:
    """
    Get MongoDB filter to scope operator queries based on authorization context.
    
    Returns:
        - {} for super admin or global access (no filter)
        - {"_id": {"$in": [...]}} for scoped access
        - {"_id": "__no_access__"} for no access
    """
    # Super admin or global access: no filter
    if context.has_global_access:
        return {}
    
    # Operator users: filter to their own operator
    if context.is_operator:
        operator_id = context.user.get("operator_id")
        if operator_id:
            return {"_id": operator_id}
        return {"_id": "__no_access__"}
    
    # Platform employees with scoped access
    if context.accessible_operator_ids:
        return {"_id": {"$in": list(context.accessible_operator_ids)}}
    
    # No access
    return {"_id": "__no_access__"}


async def can_access_operator(context: AuthorizationContext, operator_id: str, db=None) -> bool:
    """
    Check if user can access a specific operator.
    """
    if context.has_global_access:
        return True
    
    if context.is_operator:
        return context.user.get("operator_id") == operator_id
    
    return operator_id in context.accessible_operator_ids


async def can_manage_operator(context: AuthorizationContext, operator_id: str, db=None) -> bool:
    """
    Check if user can perform CRUD operations on an operator.
    More restrictive than can_access_operator.
    """
    # Super admin can manage all
    if context.is_super_admin:
        return True
    
    # Operator owners can manage their own
    if context.user_type == "operator_owner":
        return context.user.get("operator_id") == operator_id
    
    # Platform employees: check pod role
    if context.is_platform_employee and context.pod_membership:
        pod_role = context.pod_membership.get("pod_role")
        if pod_role == "team_lead":
            return operator_id in context.accessible_operator_ids
        # Other pod roles have limited management capabilities
        if pod_role in ("csm", "bdr"):
            return operator_id in context.accessible_operator_ids
    
    return False


def serialize_authorization_context(context: AuthorizationContext) -> Dict:
    """
    Serialize authorization context for API response.
    """
    return {
        "user_id": context.user_id,
        "user_type": context.user_type,
        "has_global_access": context.has_global_access,
        "pod_membership": {
            "pod_id": context.pod_membership.get("pod_id"),
            "pod_name": context.pod_membership.get("pod_name"),
            "pod_role": context.pod_membership.get("pod_role")
        } if context.pod_membership else None,
        "access_scope_count": len(context.access_scopes),
        "accessible_operator_count": len(context.accessible_operator_ids),
        "operator_context": context.operator_context
    }
