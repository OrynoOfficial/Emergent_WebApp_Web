"""
Inventory engine — iter 230.

Tracks individual rentable units across two entity types:
  - `car_rental` (cars — one document per physical car, multiple if operator has fleet duplicates)
  - `banquet_item` (chairs, plates, cutlery, etc. — one logical document per item type, with `total_units` count)

Holds (rentals) move through this lifecycle:
  reserved → out (when booking date starts) → returned (manual operator confirmation)
                                            ↘ damaged   ↘ kept_out_of_stock (toggled by operator)

The frontend "almost sold out" tag is driven by `available_units` (computed) on the
parent entity. Auto-return at end-of-rental is explicitly opt-out — the operator
must confirm returns from the dashboard.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class InventoryUnitStatus(str, Enum):
    IN_STOCK = "in_stock"            # Available to be booked.
    RESERVED = "reserved"            # Booked for a future window.
    OUT = "out"                      # Rental is currently in progress.
    RETURNED = "returned"            # Operator confirmed the unit is back.
    DAMAGED = "damaged"              # Operator flagged a damaged unit.
    OUT_OF_STOCK = "out_of_stock"    # Operator manually kept it out (maintenance, lost, etc.)


class InventoryHoldStatus(str, Enum):
    RESERVED = "reserved"
    OUT = "out"
    RETURNED = "returned"
    DAMAGED = "damaged"
    CANCELLED = "cancelled"


class InventoryUnit(BaseModel):
    """A single physical/logical unit (e.g. one chair, one car). Operators
    typically create N at a time via the `total_units` shortcut on the parent doc."""
    id: Optional[str] = Field(default=None, alias="_id")
    entity_type: str                # "car_rental" | "banquet_item"
    entity_id: str                  # parent doc id
    operator_id: str
    unit_label: Optional[str] = None  # e.g. "Chair #12" or VIN/plate for cars
    status: InventoryUnitStatus = InventoryUnitStatus.IN_STOCK
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class InventoryHold(BaseModel):
    """One row per "rental window" — links a unit (or just a count) to a booking."""
    id: Optional[str] = Field(default=None, alias="_id")
    entity_type: str
    entity_id: str
    operator_id: str
    booking_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    unit_ids: List[str] = []         # Explicit unit references (cars); empty for count-only items
    quantity: int = 1                # For count-only items (chairs, plates)
    start_date: Optional[str] = None  # ISO date — when the rental window begins
    end_date: Optional[str] = None    # ISO date — when it should be returned
    status: InventoryHoldStatus = InventoryHoldStatus.RESERVED
    returned_at: Optional[datetime] = None
    damaged_quantity: int = 0
    operator_note: Optional[str] = None  # For damage reports / keep-out messages
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class BanquetItem(BaseModel):
    """Rentable banquet inventory (NOT halls, NOT services like DJ/photographer).
    Examples: chairs, plates, glassware, cutlery, linen, decor items.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    operator_id: str
    operator_name: Optional[str] = None
    name: str                       # e.g. "Chiavari Chair (Gold)"
    description: Optional[str] = None
    category: str = "other"         # "seating" | "tableware" | "linen" | "decor" | "other"
    unit_price: float = 0.0
    images: List[str] = []
    total_units: int = 0
    available_units: int = 0        # Maintained server-side
    policies: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
