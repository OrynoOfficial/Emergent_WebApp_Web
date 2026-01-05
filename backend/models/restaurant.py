from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, time
from enum import Enum

class Restaurant(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    
    # Location
    address: str
    city: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Cuisine
    cuisine_type: List[str] = []
    
    # Rating
    average_rating: float = 0.0
    total_ratings: int = 0
    
    # Pricing
    price_range: Optional[str] = None  # "$", "$$", "$$$", "$$$$"
    average_cost_for_two: Optional[float] = None
    currency: str = "USD"
    
    # Media
    images: List[str] = []
    thumbnail: Optional[str] = None
    
    # Contact
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    
    # Hours
    opening_hours: Dict[str, Any] = {}
    
    # Features
    features: List[str] = []
    accepts_reservations: bool = True
    
    # Capacity
    total_tables: int = 0
    max_capacity: int = 0
    
    # Status
    is_active: bool = True
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class RestaurantMenu(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    restaurant_id: str
    name: str
    description: Optional[str] = None
    category: str
    
    # Pricing
    price: float
    currency: str = "USD"
    
    # Media
    image: Optional[str] = None
    
    # Dietary info
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    allergens: List[str] = []
    
    # Availability
    is_available: bool = True
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True