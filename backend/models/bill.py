from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class BillStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class Bill(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    bill_number: str
    order_id: str
    user_id: str
    operator_id: str
    operator_name: str
    service_type: str
    service_name: str
    items: List[Dict[str, Any]] = []  # [{description, quantity, unit_price, total}]
    subtotal: float
    tax_rate: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    commission_rate: float = 0
    commission_amount: float = 0
    total_amount: float
    currency: str = "XAF"
    status: BillStatus = BillStatus.DRAFT
    issued_at: Optional[datetime] = None
    due_date: Optional[str] = None
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class BillCreate(BaseModel):
    order_id: str
    user_id: str
    operator_id: str
    operator_name: str
    service_type: str
    service_name: str
    items: List[Dict[str, Any]] = []
    subtotal: float
    tax_rate: float = 0
    discount_amount: float = 0
    commission_rate: float = 0
    due_date: Optional[str] = None
    notes: Optional[str] = None
