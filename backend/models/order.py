from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentMethod(str, Enum):
    STRIPE = "stripe"
    MTN_MOMO = "mtn_momo"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"

class Order(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    order_number: str
    user_id: str
    service_id: str
    service_name: str
    service_category: str
    
    # Pricing
    subtotal: float
    tax: float = 0.0
    discount: float = 0.0
    total_amount: float
    currency: str = "USD"
    
    # Payment
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payment_method: Optional[PaymentMethod] = None
    payment_id: Optional[str] = None
    payment_intent_id: Optional[str] = None
    
    # Order details
    order_details: Dict[str, Any] = {}
    booking_date: Optional[datetime] = None
    service_date: Optional[datetime] = None
    
    # Status
    status: OrderStatus = OrderStatus.PENDING
    
    # Promo code
    promo_code: Optional[str] = None
    promo_discount: float = 0.0
    
    # Notes
    customer_notes: Optional[str] = None
    admin_notes: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True

class OrderCreate(BaseModel):
    service_id: str
    order_details: Dict[str, Any] = {}
    service_date: Optional[datetime] = None
    customer_notes: Optional[str] = None
    promo_code: Optional[str] = None