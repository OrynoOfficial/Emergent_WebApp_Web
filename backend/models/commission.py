from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class CommissionType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class CommissionConfig(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    service_type: str  # travel, hotel, restaurant, car_rental, event, etc.
    commission_type: CommissionType = CommissionType.PERCENTAGE
    base_rate: float = 5.0  # Default 5%
    operator_id: Optional[str] = None  # If null, applies to all operators
    operator_name: Optional[str] = None
    min_amount: Optional[float] = None  # Minimum commission amount
    max_amount: Optional[float] = None  # Maximum commission amount
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CommissionConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    service_type: str
    commission_type: CommissionType = CommissionType.PERCENTAGE
    base_rate: float = 5.0
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None

class CommissionConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_rate: Optional[float] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    is_active: Optional[bool] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
