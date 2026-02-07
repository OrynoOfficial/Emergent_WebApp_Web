"""
Pod Models for Internal Team Structure
Implements Pod-based isolation for platform employees
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class PodRole(str, Enum):
    """Roles within a Pod"""
    TEAM_LEAD = "team_lead"        # Full CRUD on pod's operators
    BDR = "bdr"                    # Business Development Representative
    CSM = "csm"                    # Customer Success Manager
    TECHNICIAN = "technician"      # Technical support
    SUPPORT_AGENT = "support_agent"  # Customer support


class Pod(BaseModel):
    """
    Pod entity - Internal team structure for platform employees.
    Pods are assigned specific operators and act as isolation boundaries.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    
    # Team Lead (exactly one per pod)
    team_lead_id: Optional[str] = None
    team_lead_name: Optional[str] = None  # Denormalized
    
    # Pod members (employee user IDs)
    member_ids: List[str] = []
    
    # Assigned operators (operator IDs this pod manages)
    assigned_operator_ids: List[str] = []
    
    # Pod metrics (denormalized for dashboards)
    total_operators: int = 0
    total_members: int = 0
    
    # Status
    is_active: bool = True
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class PodMembership(BaseModel):
    """
    Pod membership record - Links employee to a pod with a specific role.
    One employee can only belong to ONE pod.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pod_id: str
    pod_name: str  # Denormalized
    user_id: str
    user_name: str  # Denormalized
    user_email: str  # Denormalized
    
    # Role within the pod
    pod_role: PodRole
    
    # Status
    is_active: bool = True
    
    # Assignment metadata
    assigned_by: str
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    removed_at: Optional[datetime] = None
    removed_by: Optional[str] = None

    class Config:
        populate_by_name = True


class PodCreate(BaseModel):
    name: str
    description: Optional[str] = None
    team_lead_id: Optional[str] = None


class PodUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    team_lead_id: Optional[str] = None
    is_active: Optional[bool] = None


class PodMemberAdd(BaseModel):
    user_id: str
    pod_role: PodRole


class PodOperatorAssign(BaseModel):
    operator_ids: List[str]
