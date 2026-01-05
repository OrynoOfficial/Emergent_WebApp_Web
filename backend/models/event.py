from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class EventType(str, Enum):
    CONCERT = "concert"
    CONFERENCE = "conference"
    WORKSHOP = "workshop"
    FESTIVAL = "festival"
    SPORTS = "sports"
    EXHIBITION = "exhibition"
    PARTY = "party"
    OTHER = "other"

class EventStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    SOLD_OUT = "sold_out"

class Event(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    event_type: EventType
    operator_id: str
    operator_name: str
    venue_name: str
    venue_address: Optional[str] = None
    city: str
    start_date: str  # ISO datetime
    end_date: str
    doors_open: Optional[str] = None
    images: List[str] = []
    ticket_types: List[Dict[str, Any]] = []  # [{name, price, quantity, sold}]
    total_capacity: int = 0
    tickets_sold: int = 0
    status: EventStatus = EventStatus.DRAFT
    featured: bool = False
    tags: List[str] = []
    age_restriction: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: EventType
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    venue_name: str
    venue_address: Optional[str] = None
    city: str
    start_date: str
    end_date: str
    doors_open: Optional[str] = None
    images: List[str] = []
    ticket_types: List[Dict[str, Any]] = []
    total_capacity: int = 0
    tags: List[str] = []
    age_restriction: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[EventType] = None
    venue_name: Optional[str] = None
    venue_address: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    doors_open: Optional[str] = None
    images: Optional[List[str]] = None
    ticket_types: Optional[List[Dict[str, Any]]] = None
    total_capacity: Optional[int] = None
    status: Optional[EventStatus] = None
    featured: Optional[bool] = None
    tags: Optional[List[str]] = None
    age_restriction: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
