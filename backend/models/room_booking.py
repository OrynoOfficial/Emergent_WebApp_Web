from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum

class RoomBookingStatus(str, Enum):
    RESERVED = "reserved"  # Temporarily held
    CONFIRMED = "confirmed"  # Payment confirmed
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class RoomBooking(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    hotel_id: str
    room_id: str
    room_number: str
    user_id: str
    order_id: Optional[str] = None
    check_in_date: str  # ISO date
    check_out_date: str
    nights: int
    guests: int = 1
    guest_name: str
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    special_requests: Optional[str] = None
    status: RoomBookingStatus = RoomBookingStatus.RESERVED
    base_price: float
    total_price: float
    extras: List[Dict[str, Any]] = []  # [{name, price, quantity}]
    reserved_at: datetime = Field(default_factory=datetime.utcnow)
    reservation_expires: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class RoomReservationRequest(BaseModel):
    hotel_id: str
    room_id: str
    check_in_date: str
    check_out_date: str
    guests: int = 1
    guest_name: str
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    special_requests: Optional[str] = None

class RoomBookingConfirm(BaseModel):
    booking_id: str
    order_id: str
