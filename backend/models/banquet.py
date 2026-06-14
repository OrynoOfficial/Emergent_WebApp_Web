from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class BanquetType(str, Enum):
    WEDDING = "wedding"
    CONFERENCE = "conference"
    BIRTHDAY = "birthday"
    CORPORATE = "corporate"
    CEREMONY = "ceremony"
    OTHER = "other"

class BanquetStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


# ──────────────────────────────────────────────────────────────────────
# Event-service catalog model.
# A single `banquets` document now represents one of many service types
# operators rent out for events. The legacy "hall" use case becomes
# `category=hall`; new categories (rental items, talent, catering, etc.)
# all live in the same collection so search/booking is unified.
# ──────────────────────────────────────────────────────────────────────

class ServiceCategory(str, Enum):
    HALL = "hall"                    # event venues (legacy banquets)
    RENTAL_ITEM = "rental_item"      # chairs, plates, spoons, tables, cutlery
    CANOPY = "canopy"                # tents, marquees, gazebos
    PHOTOGRAPHER = "photographer"    # photo talent
    VIDEOGRAPHER = "videographer"    # video talent
    CATERING = "catering"            # food & beverage
    DECORATION = "decoration"        # floral, balloons, backdrops
    SOUND_LIGHTING = "sound_lighting"
    OTHER = "other"


class PricingModel(str, Enum):
    PER_EVENT = "per_event"          # flat per booking
    PER_PERSON = "per_person"        # × headcount
    PER_HOUR = "per_hour"            # × duration_hours
    PER_UNIT = "per_unit"            # × quantity (chairs, plates, canopies)
    FLAT_FEE = "flat_fee"            # set fee regardless (photographer day rate)

class Banquet(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str
    # ── category-aware fields ─────────────────────────────────────────
    category: ServiceCategory = ServiceCategory.HALL
    pricing_model: PricingModel = PricingModel.PER_EVENT
    unit_label: Optional[str] = None          # "chair", "plate", "spoon"
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    duration_hours: Optional[float] = None    # default duration for hourly talent
    # ── legacy hall fields (optional now — N/A for rental items / talent) ──
    venue_type: Optional[str] = None          # hall, garden, rooftop
    address: Optional[str] = None
    city: Optional[str] = None
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    base_price: float
    price_type: str = "per_event"             # legacy; kept for backward compat
    # Category-specific rich fields. Schema is defined on the frontend
    # (`/components/banquet/categorySchema.js`) and varies per category —
    # e.g. photographer stores `style`, `equipment`, `deliverables`,
    # `turnaround_days`, `portfolio_url`; catering stores `cuisines`,
    # `dietary_options`, `service_style`. We keep this as a free-form
    # dict on the model so adding a new field per category never needs a
    # backend migration; the operator dashboard simply renders whatever
    # keys are present.
    category_details: Dict[str, Any] = {}
    images: List[str] = []
    amenities: List[str] = []
    packages: List[Dict[str, Any]] = []
    catering_options: List[Dict[str, Any]] = []
    operating_hours: Dict[str, Any] = {}
    advance_booking_days: int = 7
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: BanquetStatus = BanquetStatus.ACTIVE
    rating: float = 0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class BanquetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    category: ServiceCategory = ServiceCategory.HALL
    pricing_model: PricingModel = PricingModel.PER_EVENT
    unit_label: Optional[str] = None
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    duration_hours: Optional[float] = None
    venue_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    base_price: float
    price_type: str = "per_event"
    category_details: Dict[str, Any] = {}
    images: List[str] = []
    amenities: List[str] = []
    packages: List[Dict[str, Any]] = []
    catering_options: List[Dict[str, Any]] = []
    operating_hours: Dict[str, Any] = {}
    advance_booking_days: int = 7
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class BanquetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ServiceCategory] = None
    pricing_model: Optional[PricingModel] = None
    unit_label: Optional[str] = None
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    duration_hours: Optional[float] = None
    venue_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    base_price: Optional[float] = None
    price_type: Optional[str] = None
    category_details: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    packages: Optional[List[Dict[str, Any]]] = None
    catering_options: Optional[List[Dict[str, Any]]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    advance_booking_days: Optional[int] = None
    cancellation_policy: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[BanquetStatus] = None


# ──────────────────────────────────────────────────────────────────────
# Bundles. A package groups N event services with a target quantity
# and an optional bundle discount. Customers can book a package in one
# click; the order is exploded into per-service line items at checkout
# so reporting stays granular.
# ──────────────────────────────────────────────────────────────────────

class PackageServiceLine(BaseModel):
    service_id: str
    quantity: float = 1   # float because per_hour can be 4.5h, per_unit can be 200, etc.

class BanquetPackageCreate(BaseModel):
    operator_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = []  # multi-image gallery for the customer-facing package modal
    services: List[PackageServiceLine]
    discount_percent: float = 0   # 0–100
    is_active: bool = True

class BanquetPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    services: Optional[List[PackageServiceLine]] = None
    discount_percent: Optional[float] = None
    is_active: Optional[bool] = None
