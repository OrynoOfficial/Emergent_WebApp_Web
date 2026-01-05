from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class RoomType(str, Enum):
    STANDARD = "standard"
    SINGLE = "single"
    DOUBLE = "double"
    TWIN = "twin"
    SUITE = "suite"
    DELUXE = "deluxe"
    FAMILY = "family"
    EXECUTIVE = "executive"
    PENTHOUSE = "penthouse"
    PRESIDENTIAL = "presidential"

class RoomStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    BLOCKED = "blocked"

class Room(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    hotel_id: str
    room_name: str
    room_type: RoomType
    floor: int = 1
    capacity: int = 2  # Max guests
    beds: int = 1
    bed_type: str = "double"  # single, double, queen, king
    size_sqm: Optional[float] = None
    base_price: float
    total_rooms: int = 1  # Total number of this room type
    available_rooms: int = 1  # Currently available rooms
    amenities: List[str] = []  # wifi, ac, tv, minibar, safe, balcony, etc.
    images: List[str] = []
    description: Optional[str] = None
    status: RoomStatus = RoomStatus.AVAILABLE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class RoomCreate(BaseModel):
    hotel_id: str
    room_name: str
    room_type: RoomType
    floor: int = 1
    capacity: int = 2
    beds: int = 1
    bed_type: str = "double"
    size_sqm: Optional[float] = None
    base_price: float
    total_rooms: int = 1
    available_rooms: Optional[int] = None  # Defaults to total_rooms if not provided
    amenities: List[str] = []
    images: List[str] = []
    description: Optional[str] = None

class RoomUpdate(BaseModel):
    room_name: Optional[str] = None
    room_type: Optional[RoomType] = None
    floor: Optional[int] = None
    capacity: Optional[int] = None
    beds: Optional[int] = None
    bed_type: Optional[str] = None
    size_sqm: Optional[float] = None
    base_price: Optional[float] = None
    total_rooms: Optional[int] = None
    available_rooms: Optional[int] = None
    amenities: Optional[List[str]] = None
    images: Optional[List[str]] = None
    description: Optional[str] = None
    status: Optional[RoomStatus] = None
