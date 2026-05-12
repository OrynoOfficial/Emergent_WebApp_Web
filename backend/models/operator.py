from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class OperatorStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"

class OperatorType(str, Enum):
    TRAVEL = "travel"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    CAR_RENTAL = "car_rental"
    EVENT = "event"
    LAUNDRY = "laundry"
    BANQUET = "banquet"
    CINEMA = "cinema"
    PHARMACY = "pharmacy"
    MULTI = "multi"  # Multiple service types

class MarketSegment(str, Enum):
    """Market segment classification for operators"""
    SME = "sme"              # Small and Medium Enterprises
    ENTERPRISE = "enterprise"  # Large enterprises
    STRATEGIC = "strategic"    # High-value strategic partners

class Operator(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    business_name: Optional[str] = None
    operator_type: OperatorType
    service_types: List[str] = []  # For multi-service operators
    email: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    
    # Geographic attributes (for attribute-based access control)
    country: str = "CM"  # ISO 3166-1 alpha-2 code, default Cameroon
    region: Optional[str] = None  # Region code (e.g., "CM-LT" for Littoral)
    
    # Market classification (dynamic - stored as string, not enum)
    market_segment: str = "sme"
    
    logo_url: Optional[str] = None
    description: Optional[str] = None
    status: OperatorStatus = OperatorStatus.PENDING
    commission_rate: float = 5.0  # Default 5%
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    tax_id: Optional[str] = None
    documents: List[Dict[str, Any]] = []  # [{name, url, type}]
    owner_user_id: Optional[str] = None  # Link to user account
    
    # Pod assignment (for internal team management)
    assigned_pod_id: Optional[str] = None
    assigned_pod_name: Optional[str] = None  # Denormalized
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class OperatorCreate(BaseModel):
    name: str
    business_name: Optional[str] = None
    operator_type: OperatorType
    service_types: List[str] = []
    email: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "CM"
    region: Optional[str] = None
    market_segment: str = "sme"
    logo_url: Optional[str] = None
    description: Optional[str] = None
    commission_rate: float = 5.0
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    tax_id: Optional[str] = None
    # Owner account creation (optional)
    create_owner_account: bool = False
    owner_full_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_password: Optional[str] = None
    owner_permissions: Optional[List[str]] = None  # pre-assigned scoped permissions

class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    business_name: Optional[str] = None
    service_types: Optional[List[str]] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    market_segment: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[OperatorStatus] = None
    commission_rate: Optional[float] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    tax_id: Optional[str] = None
