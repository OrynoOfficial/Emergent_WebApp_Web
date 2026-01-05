from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class TravelRoute(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    operator_id: Optional[str] = None
    route_name: str
    
    # Route details
    origin: str
    destination: str
    stops: List[Dict[str, Any]] = []
    
    # Pricing
    base_fare: float
    currency: str = "USD"
    
    # Schedule
    departure_time: str
    arrival_time: str
    duration_minutes: int
    
    # Vehicle info
    vehicle_type: Optional[str] = None
    total_seats: int = 0
    available_seats: int = 0
    
    # Features
    amenities: List[str] = []
    
    # Status
    is_active: bool = True
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class CarRental(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    operator_id: Optional[str] = None
    
    # Vehicle details
    make: str
    model: str
    year: int
    color: Optional[str] = None
    license_plate: Optional[str] = None
    
    # Vehicle type
    vehicle_type: str  # sedan, suv, van, etc.
    
    # Capacity
    seats: int
    doors: int
    
    # Transmission
    transmission: str  # automatic, manual
    
    # Fuel
    fuel_type: str  # petrol, diesel, electric, hybrid
    
    # Pricing
    price_per_day: float
    price_per_hour: Optional[float] = None
    currency: str = "USD"
    
    # Features
    features: List[str] = []
    
    # Media
    images: List[str] = []
    thumbnail: Optional[str] = None
    
    # Location
    pickup_location: Optional[str] = None
    
    # Availability
    is_available: bool = True
    
    # Rating
    average_rating: float = 0.0
    total_ratings: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True