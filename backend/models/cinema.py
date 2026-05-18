from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class CinemaStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class FilmStatus(str, Enum):
    NOW_SHOWING = "now_showing"
    COMING_SOON = "coming_soon"
    ENDED = "ended"

class Cinema(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    images: List[str] = []
    screens: List[Dict[str, Any]] = []  # [{name, capacity, screen_type: 2d/3d/imax}]
    amenities: List[str] = []  # parking, snacks, vip_lounge, etc.
    operating_hours: Dict[str, Any] = {}
    status: CinemaStatus = CinemaStatus.ACTIVE
    rating: float = 0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class Film(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    title: str
    description: Optional[str] = None
    genre: List[str] = []
    duration_minutes: int
    language: str = "English"
    subtitles: List[str] = []
    rating: str = "PG"  # G, PG, PG-13, R, NC-17
    director: Optional[str] = None
    cast: List[str] = []
    poster_url: Optional[str] = None
    trailer_url: Optional[str] = None
    release_date: Optional[str] = None
    status: FilmStatus = FilmStatus.NOW_SHOWING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class Showtime(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    cinema_id: str
    film_id: str
    screen_name: str
    screen_type: str = "2d"
    show_date: str  # ISO date
    show_time: str  # HH:MM
    end_time: str
    price: float
    vip_price: Optional[float] = None
    total_seats: int
    available_seats: int
    seat_layout: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CinemaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    images: List[str] = []
    screens: List[Dict[str, Any]] = []
    amenities: List[str] = []
    operating_hours: Dict[str, Any] = {}

class CinemaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    images: Optional[List[str]] = None
    screens: Optional[List[Dict[str, Any]]] = None
    amenities: Optional[List[str]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    status: Optional[CinemaStatus] = None
