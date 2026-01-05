from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class SeatStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"  # Temporarily held
    BOOKED = "booked"  # Payment confirmed
    BLOCKED = "blocked"  # Not available for booking

class SeatBooking(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    route_id: str
    vehicle_id: str
    travel_date: str  # ISO date
    seat_number: str
    seat_row: int
    seat_column: int
    status: SeatStatus = SeatStatus.AVAILABLE
    user_id: Optional[str] = None
    order_id: Optional[str] = None
    passenger_name: Optional[str] = None
    passenger_id_number: Optional[str] = None
    passenger_phone: Optional[str] = None
    reserved_at: Optional[datetime] = None
    reservation_expires: Optional[datetime] = None  # For temporary holds
    booked_at: Optional[datetime] = None
    price: float = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class SeatReservationRequest(BaseModel):
    route_id: str
    travel_date: str
    seat_numbers: List[str]  # List of seat numbers to reserve

class SeatBookingConfirm(BaseModel):
    route_id: str
    travel_date: str
    seat_numbers: List[str]
    passengers: List[Dict[str, Any]]  # [{seat_number, name, id_number, phone}]
    order_id: str
