from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class BanquetType(str, Enum):
    WEDDING = "wedding"
    CONFERENCE = "conference"
    BIRTHDAY = "birthday"
    CORPORATE = "corporate"
    CEREMONY = "ceremony"
    OTHER = "other"

class BanquetStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class Banquet(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str
    venue_type: str  # hall, garden, rooftop, etc.
    address: str
    city: str
    capacity_min: int = 10
    capacity_max: int = 100
    base_price: float  # Per event or per person
    price_type: str = "per_event"  # per_event, per_person
    images: List[str] = []
    amenities: List[str] = []  # parking, catering, decoration, sound_system, etc.
    packages: List[Dict[str, Any]] = []  # [{name, description, price, includes: []}]
    catering_options: List[Dict[str, Any]] = []  # [{name, price_per_person, menu_items: []}]
    operating_hours: Dict[str, Any] = {}
    advance_booking_days: int = 7  # Minimum days in advance
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: BanquetStatus = BanquetStatus.ACTIVE
    rating: float = 0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class BanquetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    venue_type: str
    address: str
    city: str
    capacity_min: int = 10
    capacity_max: int = 100
    base_price: float
    price_type: str = "per_event"
    images: List[str] = []
    amenities: List[str] = []
    packages: List[Dict[str, Any]] = []
    catering_options: List[Dict[str, Any]] = []
    operating_hours: Dict[str, Any] = {}
    advance_booking_days: int = 7
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class BanquetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    venue_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    base_price: Optional[float] = None
    price_type: Optional[str] = None
    images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    packages: Optional[List[Dict[str, Any]]] = None
    catering_options: Optional[List[Dict[str, Any]]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    advance_booking_days: Optional[int] = None
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[BanquetStatus] = None
