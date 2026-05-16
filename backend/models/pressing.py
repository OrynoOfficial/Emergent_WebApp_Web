from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class LaundryServiceType(str, Enum):
    WASH = "wash"
    DRY_CLEAN = "dry_clean"
    IRON = "iron"
    WASH_IRON = "wash_iron"
    FULL_SERVICE = "full_service"


class LaundryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


# Shop pricing model — a laundry shop charges by kilo, a pressing shop charges
# per item (shirt / trousers / suit …), and many shops do both.
class ShopType(str, Enum):
    LAUNDRY = "laundry"
    PRESSING = "pressing"
    BOTH = "both"


# A single per-item pressing price (only used when shop_type ∈ {pressing,both}).
class ItemPrice(BaseModel):
    item: str = Field(..., min_length=1, description="Item label, e.g. 'Shirt'")
    price: float = Field(..., ge=0, description="Unit price in shop currency")
    # Optional thumbnail — uploaded via `POST /api/uploads/`. Helps customers
    # spot what they're paying for at a glance on the booking page.
    image_url: Optional[str] = Field(default=None, description="Thumbnail URL for this item")


# A common operating-hours payload — kept loose for legacy compatibility.
# Example: {"monday": {"open": "08:00", "close": "20:00", "closed": false}, ...}


# ─────────────────────── Persistent document ───────────────────────
class Pressing(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    operator_id: str
    operator_name: str

    # Pricing model
    shop_type: ShopType = ShopType.LAUNDRY
    price_per_kg: Optional[float] = None             # laundry / both
    item_prices: List[ItemPrice] = []                # pressing / both

    # Location & contact
    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None

    # Storefront
    images: List[str] = []
    services: List[str] = []                          # tags: ['washing', 'ironing', ...]
    operating_hours: Dict[str, Any] = {}
    turnaround_hours: int = 24                        # standard turnaround in hours

    # Delivery / pickup
    delivery_available: bool = False
    delivery_fee: float = 0
    pickup_radius_km: float = 0
    express_available: bool = False
    express_surcharge: float = 0
    min_order_amount: float = 0

    # Accepted payments
    accepts_card: bool = False
    accepts_momo: bool = True
    accepts_cash: bool = True

    # Lifecycle
    status: LaundryStatus = LaundryStatus.ACTIVE
    rating: float = 0
    total_reviews: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ─────────────────────── Create payload ───────────────────────
class PressingCreate(BaseModel):
    name: str
    description: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None

    shop_type: ShopType = ShopType.LAUNDRY
    price_per_kg: Optional[float] = None
    item_prices: List[ItemPrice] = []

    address: str
    city: str
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None

    images: List[str] = []
    services: List[str] = []
    operating_hours: Dict[str, Any] = {}
    turnaround_hours: int = 24

    delivery_available: bool = False
    delivery_fee: float = 0
    pickup_radius_km: float = 0
    express_available: bool = False
    express_surcharge: float = 0
    min_order_amount: float = 0

    accepts_card: bool = False
    accepts_momo: bool = True
    accepts_cash: bool = True

    @field_validator("services", mode="before")
    @classmethod
    def _coerce_legacy_services(cls, v):
        # Legacy callers used to send `[{"name": "washing"}]`; normalize to ["washing"].
        if isinstance(v, list):
            out = []
            for s in v:
                if isinstance(s, str):
                    out.append(s)
                elif isinstance(s, dict):
                    label = s.get("type") or s.get("name") or s.get("label")
                    if label:
                        out.append(str(label))
            return out
        return v


# ─────────────────────── Update payload ───────────────────────
class PressingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

    shop_type: Optional[ShopType] = None
    price_per_kg: Optional[float] = None
    item_prices: Optional[List[ItemPrice]] = None

    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None

    images: Optional[List[str]] = None
    services: Optional[List[str]] = None
    operating_hours: Optional[Dict[str, Any]] = None
    turnaround_hours: Optional[int] = None

    delivery_available: Optional[bool] = None
    delivery_fee: Optional[float] = None
    pickup_radius_km: Optional[float] = None
    express_available: Optional[bool] = None
    express_surcharge: Optional[float] = None
    min_order_amount: Optional[float] = None

    accepts_card: Optional[bool] = None
    accepts_momo: Optional[bool] = None
    accepts_cash: Optional[bool] = None

    status: Optional[LaundryStatus] = None

    @field_validator("services", mode="before")
    @classmethod
    def _coerce_legacy_services(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            out = []
            for s in v:
                if isinstance(s, str):
                    out.append(s)
                elif isinstance(s, dict):
                    label = s.get("type") or s.get("name") or s.get("label")
                    if label:
                        out.append(str(label))
            return out
        return v


# ─────────────────────── Reference data ───────────────────────
# Common per-item categories surfaced as suggestions on the create-shop modal.
DEFAULT_PRESSING_ITEM_PRESETS: List[str] = [
    "Shirt",
    "T-shirt",
    "Trousers / Pants",
    "Jeans",
    "Suit (2-piece)",
    "Suit (3-piece)",
    "Jacket / Blazer",
    "Dress",
    "Skirt",
    "Boubou (traditional)",
    "Kaftan",
    "Bedsheet",
    "Duvet",
    "Curtain (per panel)",
    "Tablecloth",
    "Towel",
]
