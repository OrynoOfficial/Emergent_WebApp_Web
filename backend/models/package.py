from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class PackageType(str, Enum):
    TOUR = "tour"
    VACATION = "vacation"
    HONEYMOON = "honeymoon"
    ADVENTURE = "adventure"
    BUSINESS = "business"
    PILGRIMAGE = "pilgrimage"
    CUSTOM = "custom"

class PackageStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SOLD_OUT = "sold_out"

class PackageService(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    package_type: PackageType
    operator_id: str
    operator_name: str
    destination: str
    origin: Optional[str] = None
    duration_days: int
    duration_nights: int
    images: List[str] = []
    itinerary: List[Dict[str, Any]] = []  # [{day, title, description, activities: []}]
    inclusions: List[str] = []  # What's included
    exclusions: List[str] = []  # What's not included
    base_price: float
    price_per_person: bool = True
    min_travelers: int = 1
    max_travelers: Optional[int] = None
    departure_dates: List[str] = []  # Available departure dates
    hotels_included: List[Dict[str, Any]] = []  # [{name, stars, nights}]
    meals_included: Dict[str, int] = {}  # {breakfast: 3, lunch: 2, dinner: 2}
    transport_included: List[str] = []  # flight, bus, train, car
    activities_included: List[str] = []
    status: PackageStatus = PackageStatus.DRAFT
    featured: bool = False
    tags: List[str] = []
    cancellation_policy: Optional[str] = None
    rating: float = 0
    total_reviews: int = 0
    total_bookings: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class PackageServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    package_type: PackageType
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    destination: str
    origin: Optional[str] = None
    duration_days: int
    duration_nights: int
    images: List[str] = []
    itinerary: List[Dict[str, Any]] = []
    inclusions: List[str] = []
    exclusions: List[str] = []
    base_price: float
    price_per_person: bool = True
    min_travelers: int = 1
    max_travelers: Optional[int] = None
    departure_dates: List[str] = []
    hotels_included: List[Dict[str, Any]] = []
    meals_included: Dict[str, int] = {}
    transport_included: List[str] = []
    activities_included: List[str] = []
    tags: List[str] = []
    cancellation_policy: Optional[str] = None

class PackageServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    package_type: Optional[PackageType] = None
    destination: Optional[str] = None
    origin: Optional[str] = None
    duration_days: Optional[int] = None
    duration_nights: Optional[int] = None
    images: Optional[List[str]] = None
    itinerary: Optional[List[Dict[str, Any]]] = None
    inclusions: Optional[List[str]] = None
    exclusions: Optional[List[str]] = None
    base_price: Optional[float] = None
    price_per_person: Optional[bool] = None
    min_travelers: Optional[int] = None
    max_travelers: Optional[int] = None
    departure_dates: Optional[List[str]] = None
    hotels_included: Optional[List[Dict[str, Any]]] = None
    meals_included: Optional[Dict[str, int]] = None
    transport_included: Optional[List[str]] = None
    activities_included: Optional[List[str]] = None
    status: Optional[PackageStatus] = None
    featured: Optional[bool] = None
    tags: Optional[List[str]] = None
    cancellation_policy: Optional[str] = None
