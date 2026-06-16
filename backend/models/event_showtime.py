"""
Event Showtime — a scheduled instance at an EventLocation.

Each Showtime carries its own `classes` array (VIP / Standard / Economy / ...)
with per-class capacity, available_units and price. Booking a ticket for class
X decrements `class.available_units` atomically; the operator can also wire
inventory_holds against `entity_type=event_class` for the full
mark-out / damage / refund lifecycle.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ShowtimeStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SOLD_OUT = "sold_out"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class TicketClass(BaseModel):
    """A pricing tier inside a Showtime — VIP, Standard, Backstage Pass, ..."""
    id: str                           # Stable ID so we can target a class on $inc updates.
    name: str
    price: float
    currency: str = "XAF"
    total_units: int
    available_units: int
    color: Optional[str] = None       # Hex for the customer-facing chip.
    perks: List[str] = []             # ["Welcome drink", "VIP entrance", ...]
    zone_id: Optional[str] = None     # Optional link to a Location zone (zones layout).
    description: Optional[str] = None
    booked_seats: List[str] = []      # Seat IDs taken so far ("R3-S12" style). Only used
                                       # when the parent Location.layout_type is "visual_grid"
                                       # or "zones" with seat-level selection.


class EventShowtime(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    location_id: str
    location_name: str                # Denormalised for fast list rendering.
    operator_id: str
    operator_name: str
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = None  # concert/conference/workshop/sport/festival/...
    images: List[str] = []            # Event-specific posters (independent of Location photos).
    start_datetime: str               # ISO datetime
    end_datetime: str
    doors_open_at: Optional[str] = None
    classes: List[TicketClass] = []
    status: ShowtimeStatus = ShowtimeStatus.DRAFT
    featured: bool = False
    tags: List[str] = []
    age_restriction: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class TicketClassInput(BaseModel):
    """Class as the operator sends it on create/update — total_units doubles
    as `available_units` at creation time; the backend keeps the two in sync
    as bookings come in."""
    name: str
    price: float
    currency: str = "XAF"
    total_units: int
    color: Optional[str] = None
    perks: List[str] = []
    zone_id: Optional[str] = None
    description: Optional[str] = None


class EventShowtimeCreate(BaseModel):
    location_id: str
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    images: List[str] = []
    start_datetime: str
    end_datetime: str
    doors_open_at: Optional[str] = None
    classes: List[TicketClassInput] = []
    featured: bool = False
    tags: List[str] = []
    age_restriction: Optional[int] = None
    status: ShowtimeStatus = ShowtimeStatus.DRAFT


class EventShowtimeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    images: Optional[List[str]] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    doors_open_at: Optional[str] = None
    classes: Optional[List[TicketClassInput]] = None
    featured: Optional[bool] = None
    tags: Optional[List[str]] = None
    age_restriction: Optional[int] = None
    status: Optional[ShowtimeStatus] = None
