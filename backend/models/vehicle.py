from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class VehicleType(str, Enum):
    NORMAL = "normal"
    VIP = "vip"
    LUXURY = "luxury"

class MaintenanceStatus(str, Enum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"

class SeatLayout(BaseModel):
    rows: int
    columns: int
    layout_type: str = "2-2"  # 2-2, 2-3, custom
    driver_position: str = "left"
    special_positions: List[Dict[str, Any]] = []  # [{row, column, type: 'aisle'|'door'|'blocked'}]
    seat_numbering: str = "sequential"  # sequential or row-column
    total_seats: int

class Vehicle(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    vehicle_name: str
    vehicle_type: VehicleType = VehicleType.NORMAL
    plate_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    operator_id: str
    operator_name: str
    amenities: List[str] = []  # wifi, ac, power_outlet, restroom, tv_screen, reclining_seats, refreshments
    seat_layout: Optional[SeatLayout] = None
    total_seats: int = 0
    maintenance_status: MaintenanceStatus = MaintenanceStatus.ACTIVE
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class VehicleCreate(BaseModel):
    vehicle_name: str
    vehicle_type: VehicleType = VehicleType.NORMAL
    plate_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    amenities: List[str] = []
    seat_layout: Optional[Dict[str, Any]] = None
    total_seats: int = 0
    maintenance_status: MaintenanceStatus = MaintenanceStatus.ACTIVE
    notes: Optional[str] = None

class VehicleUpdate(BaseModel):
    vehicle_name: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    plate_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    amenities: Optional[List[str]] = None
    seat_layout: Optional[Dict[str, Any]] = None
    total_seats: Optional[int] = None
    maintenance_status: Optional[MaintenanceStatus] = None
    notes: Optional[str] = None
