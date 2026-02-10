"""
Employee Access Scope Models
Implements attribute-based scoping for platform employees
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class EmployeeAccessScope(BaseModel):
    """
    Access Scope for platform employees (Admins/Technicians).
    Each employee can have multiple scopes, combined with OR logic.
    Empty fields act as wildcards (all values).
    Multiple fields within a scope are combined with AND logic.
    
    Example:
    - Scope 1: countries=["CM"], market_segments=["sme"]
      → Access to SME operators in Cameroon only
    - Scope 2: service_types=["travel"]
      → Access to all travel operators globally
    
    Employee with both scopes: Can access SME operators in Cameroon OR any travel operator
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Scope name for identification
    name: str
    description: Optional[str] = None
    
    # Attribute filters (empty = wildcard/all)
    countries: List[str] = []          # Country codes (e.g., ["CM", "NG"])
    regions: List[str] = []            # Region codes (e.g., ["CM-CE", "CM-LT"])
    market_segments: List[str] = []    # ["sme", "enterprise", "strategic"]
    service_types: List[str] = []      # ["travel", "hotel", "restaurant", etc.]
    
    # Specific operator override (if set, ONLY these operators are accessible)
    specific_operator_ids: List[str] = []
    
    # Pods assigned to this scope
    assigned_pod_ids: List[str] = []
    
    # Status
    is_active: bool = True
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class EmployeeScopeAssignment(BaseModel):
    """
    Links an employee user to one or more access scopes.
    Multiple scopes are combined with OR logic.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str  # Denormalized
    scope_id: str
    scope_name: str  # Denormalized
    
    # Assignment metadata
    assigned_by: str
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        populate_by_name = True


class EmployeeAccessScopeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    countries: List[str] = []
    regions: List[str] = []
    market_segments: List[str] = []
    service_types: List[str] = []
    specific_operator_ids: List[str] = []
    assigned_pod_ids: List[str] = []


class EmployeeAccessScopeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    countries: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    market_segments: Optional[List[str]] = None
    service_types: Optional[List[str]] = None
    specific_operator_ids: Optional[List[str]] = None
    assigned_pod_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class EmployeeScopeAssignmentCreate(BaseModel):
    user_id: str
    scope_id: str
