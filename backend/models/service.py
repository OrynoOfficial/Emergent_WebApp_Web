from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ServiceCategory(str, Enum):
    TRAVEL = "travel"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    CAR_RENTAL = "car_rental"
    PHARMACY = "pharmacy"
    EVENT = "event"
    CINEMA = "cinema"
    ENTERTAINMENT = "entertainment"
    LAUNDRY = "laundry"
    PRESSING = "pressing"
    BANQUET = "banquet"
    PACKAGE = "package"

class ServiceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_APPROVAL = "pending_approval"

class Service(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    category: ServiceCategory
    operator_id: Optional[str] = None
    
    # Pricing
    base_price: float = 0.0
    currency: str = "USD"
    
    # Location
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Media
    images: List[str] = []
    thumbnail: Optional[str] = None
    
    # Availability
    is_available: bool = True
    status: ServiceStatus = ServiceStatus.ACTIVE
    
    # Features/Amenities
    features: List[str] = []
    amenities: Dict[str, Any] = {}
    
    # Ratings
    average_rating: float = 0.0
    total_ratings: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: ServiceCategory
    base_price: float = 0.0
    currency: str = "USD"
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None