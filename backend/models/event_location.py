"""
Event Location — the physical venue an event takes place at.
Mirrors how Cinema separates a Cinema (venue) from a Showtime (instance).

Three seating-plan flavours are supported; operators pick the one that fits
their venue:
  * `simple`       — a high-level kind (theater_rows, banquet_round, open_air,
                     standing, mixed) + a single total capacity number.
  * `visual_grid`  — concrete rows × columns with an optional aisle marker so
                     the customer-facing UI can render a picker like the bus
                     seat map.
  * `zones`        — operator-defined named zones with per-zone capacities
                     ("Front Row" = 50, "VIP Tables" = 30, "General" = 200).
                     Showtime then sets a price per zone.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class LayoutType(str, Enum):
    SIMPLE = "simple"
    VISUAL_GRID = "visual_grid"
    ZONES = "zones"


class SimpleLayoutKind(str, Enum):
    THEATER_ROWS = "theater_rows"
    BANQUET_ROUND = "banquet_round"
    OPEN_AIR = "open_air"
    STANDING = "standing"
    MIXED = "mixed"


class Zone(BaseModel):
    """Named seating section on a `zones` layout."""
    id: str
    name: str
    capacity: int
    color: Optional[str] = None         # Hex string — surfaced as the badge tint on customer UI.


class EventLocation(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str
    images: List[str] = []
    city: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # ── Seating plan ─────────────────────────────────────────────────
    layout_type: LayoutType = LayoutType.SIMPLE
    capacity: int = 0
    simple_kind: Optional[SimpleLayoutKind] = None
    grid_rows: Optional[int] = None
    grid_cols: Optional[int] = None
    grid_aisle_after: Optional[int] = None
    zones: List[Zone] = []
    # ── Misc ─────────────────────────────────────────────────────────
    policies: List[str] = []
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class EventLocationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    images: List[str] = []
    city: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    layout_type: LayoutType = LayoutType.SIMPLE
    capacity: int = 0
    simple_kind: Optional[SimpleLayoutKind] = None
    grid_rows: Optional[int] = None
    grid_cols: Optional[int] = None
    grid_aisle_after: Optional[int] = None
    zones: List[Zone] = []
    policies: List[str] = []
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class EventLocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    layout_type: Optional[LayoutType] = None
    capacity: Optional[int] = None
    simple_kind: Optional[SimpleLayoutKind] = None
    grid_rows: Optional[int] = None
    grid_cols: Optional[int] = None
    grid_aisle_after: Optional[int] = None
    zones: Optional[List[Zone]] = None
    policies: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None
