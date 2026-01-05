from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class LaundryServiceType(str, Enum):
    WASH = "wash"
    DRY_CLEAN = "dry_clean"
    IRON = "iron"
    WASH_IRON = "wash_iron"
    FULL_SERVICE = "full_service"

class LaundryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class Pressing(BaseModel):  # Laundry/Pressing service
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    images: List[str] = []
    services: List[Dict[str, Any]] = []  # [{name, type, price, description}]
    operating_hours: Dict[str, Any] = {}  # {monday: {open, close}, ...}
    delivery_available: bool = False
    delivery_fee: float = 0
    express_available: bool = False
    express_surcharge: float = 0
    min_order_amount: float = 0
    status: LaundryStatus = LaundryStatus.ACTIVE
    rating: float = 0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class PressingCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    images: List[str] = []
    services: List[Dict[str, Any]] = []
    operating_hours: Dict[str, Any] = {}
    delivery_available: bool = False
    delivery_fee: float = 0
    express_available: bool = False
    express_surcharge: float = 0
    min_order_amount: float = 0

class PressingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    images: Optional[List[str]] = None
    services: Optional[List[Dict[str, Any]]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    delivery_available: Optional[bool] = None
    delivery_fee: Optional[float] = None
    express_available: Optional[bool] = None
    express_surcharge: Optional[float] = None
    min_order_amount: Optional[float] = None
    status: Optional[LaundryStatus] = None
