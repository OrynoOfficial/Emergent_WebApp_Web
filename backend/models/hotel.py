from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class Hotel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    
    # Location
    address: str
    city: str
    country: str
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Rating
    star_rating: Optional[int] = None
    average_rating: float = 0.0
    total_ratings: int = 0
    
    # Amenities
    amenities: List[str] = []
    
    # Media
    images: List[str] = []
    thumbnail: Optional[str] = None
    
    # Rooms
    total_rooms: int = 0
    available_rooms: int = 0
    
    # Contact
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    
    # Status
    is_active: bool = True
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class Room(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    hotel_id: str
    room_type: str
    room_number: str
    description: Optional[str] = None
    
    # Pricing
    price_per_night: float
    currency: str = "USD"
    
    # Capacity
    max_guests: int
    num_beds: int
    bed_type: Optional[str] = None
    
    # Amenities
    amenities: List[str] = []
    
    # Media
    images: List[str] = []
    
    # Availability
    is_available: bool = True
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True