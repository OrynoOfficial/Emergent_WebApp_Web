from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class RouteStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class TravelRoute(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    from_city: str
    to_city: str
    departure_time: str  # HH:MM format
    arrival_time: str
    duration: str  # e.g., "3h 30m"
    price: float
    operator_id: str
    operator_name: str
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_type: str = "normal"  # normal, vip, luxury
    total_seats: int = 0
    available_seats: int = 0
    seat_layout: Optional[Dict[str, Any]] = None
    amenities: List[str] = []
    status: RouteStatus = RouteStatus.PENDING
    active: bool = False
    valid_from: Optional[str] = None  # ISO date
    valid_to: Optional[str] = None
    edited_field_message: Optional[str] = None  # For tracking edits
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class TravelRouteCreate(BaseModel):
    from_city: str
    to_city: str
    departure_time: str
    arrival_time: str
    duration: Optional[str] = None
    price: float
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_type: str = "normal"
    total_seats: int = 0
    available_seats: Optional[int] = None
    seat_layout: Optional[Dict[str, Any]] = None
    amenities: List[str] = []
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None

class TravelRouteUpdate(BaseModel):
    from_city: Optional[str] = None
    to_city: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration: Optional[str] = None
    price: Optional[float] = None
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    total_seats: Optional[int] = None
    available_seats: Optional[int] = None
    seat_layout: Optional[Dict[str, Any]] = None
    amenities: Optional[List[str]] = None
    status: Optional[RouteStatus] = None
    active: Optional[bool] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
