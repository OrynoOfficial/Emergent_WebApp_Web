from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class PromoCodeType:
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class PromoCode(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    code: str  # Unique promo code
    name: str
    description: Optional[str] = None
    discount_type: str = "percentage"  # percentage or fixed
    discount_value: float  # Percentage (0-100) or fixed amount
    min_order_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None  # Cap for percentage discounts
    service_types: List[str] = []  # Empty = all services
    operator_id: Optional[str] = None  # If set, only for this operator
    operator_name: Optional[str] = None
    usage_limit: Optional[int] = None  # Total uses allowed
    per_user_limit: int = 1  # Uses per user
    times_used: int = 0
    valid_from: str  # ISO datetime
    valid_to: str
    is_active: bool = True
    first_order_only: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class PromoCodeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str = "percentage"
    discount_value: float
    min_order_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    service_types: List[str] = []
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    usage_limit: Optional[int] = None
    per_user_limit: int = 1
    valid_from: str
    valid_to: str
    first_order_only: bool = False

class PromoCodeValidate(BaseModel):
    code: str
    service_type: Optional[str] = None
    order_amount: Optional[float] = None
    operator_id: Optional[str] = None
