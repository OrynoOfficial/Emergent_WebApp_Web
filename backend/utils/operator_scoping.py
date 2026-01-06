"""
Operator Scoping Utilities
Helper functions for applying operator-based data filtering across service routes
"""
from typing import Optional, Dict, Any
from config.database import get_database


def get_operator_filter(current_user: dict, operator_id_field: str = "operator_id") -> dict:
    """
    Returns a MongoDB filter to scope queries to the user's operator.
    Returns empty dict for super_admin/admin (no filter needed).
    
    Args:
        current_user: The authenticated user dict
        operator_id_field: The field name to filter on (default: "operator_id")
    
    Returns:
        MongoDB filter dict
    """
    if current_user.get("role") in ["super_admin", "admin"]:
        return {}
    
    operator_id = current_user.get("operator_id")
    if not operator_id:
        # User not assigned to operator - return filter that matches nothing
        return {operator_id_field: "__no_access__"}
    
    return {operator_id_field: operator_id}


def merge_queries(base_query: dict, operator_filter: dict) -> dict:
    """
    Merge a base query with operator filter.
    Handles $and correctly if already present.
    """
    if not operator_filter:
        return base_query
    
    if not base_query:
        return operator_filter
    
    # Merge the queries
    merged = {**base_query, **operator_filter}
    return merged


async def verify_operator_resource_access(
    current_user: dict,
    resource_id: str,
    collection_name: str,
    operator_id_field: str = "operator_id"
) -> dict:
    """
    Verify that the current user has access to a specific resource.
    Returns the resource if access is granted, raises HTTPException otherwise.
    
    Args:
        current_user: The authenticated user dict
        resource_id: The ID of the resource to check
        collection_name: The MongoDB collection name
        operator_id_field: The field name containing the operator ID
    
    Returns:
        The resource document
    
    Raises:
        HTTPException: If resource not found or access denied
    """
    from fastapi import HTTPException, status
    
    db = get_database()
    collection = db[collection_name]
    
    resource = await collection.find_one({"_id": resource_id})
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )
    
    # Super admin and admin can access any resource
    if current_user.get("role") in ["super_admin", "admin"]:
        return resource
    
    # Check operator ownership
    resource_operator_id = resource.get(operator_id_field)
    user_operator_id = current_user.get("operator_id")
    
    if not user_operator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to any operator"
        )
    
    if resource_operator_id != user_operator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this resource"
        )
    
    return resource


def get_service_types_for_operator(operator_context: Optional[dict]) -> list:
    """
    Get list of service types the operator manages.
    
    Args:
        operator_context: The operator context dict from the user
    
    Returns:
        List of service type strings
    """
    if not operator_context:
        return []
    
    service_types = operator_context.get("service_types", [])
    if not service_types:
        # Fall back to operator_type if service_types not set
        op_type = operator_context.get("operator_type")
        if op_type:
            service_types = [op_type]
    
    return service_types


def can_access_service_type(current_user: dict, service_type: str) -> bool:
    """
    Check if the current user's operator can access a specific service type.
    Super admin and admin can access all service types.
    
    Args:
        current_user: The authenticated user dict
        service_type: The service type to check
    
    Returns:
        True if access is allowed, False otherwise
    """
    if current_user.get("role") in ["super_admin", "admin"]:
        return True
    
    operator_context = current_user.get("_operator_context", {})
    if not operator_context:
        return False
    
    allowed_types = get_service_types_for_operator(operator_context)
    return service_type in allowed_types or operator_context.get("operator_type") == service_type
