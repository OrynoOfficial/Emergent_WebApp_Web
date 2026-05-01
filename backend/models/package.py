from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class PackageType(str, Enum):
    DOCUMENT = "document"
    PARCEL = "parcel"
    FRAGILE = "fragile"
    PERISHABLE = "perishable"
    ELECTRONICS = "electronics"
    HEAVY_GOODS = "heavy_goods"
    OTHER = "other"


class PackageStatus(str, Enum):
    PENDING = "pending"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PAID = "paid"
    REFUNDED = "refunded"


class PricingModel(str, Enum):
    TIERED = "tiered"          # Weight-bracket tiers
    PER_KG = "per_kg"          # base_price + per_kg_rate


class WeightTier(BaseModel):
    """A single price tier for the tiered model."""
    weight_min_kg: float = 0
    weight_max_kg: float = 0
    price: float = 0
    max_length_cm: Optional[float] = None
    max_width_cm: Optional[float] = None
    max_height_cm: Optional[float] = None
    label: Optional[str] = None  # e.g. "Small", "Medium", "Large"


class PackageServiceOfferingBase(BaseModel):
    """Operator-published package pickup & delivery service."""
    name: str
    description: Optional[str] = None
    origin_city: str
    destination_city: str
    pricing_model: PricingModel = PricingModel.TIERED
    tiers: List[WeightTier] = []  # used when pricing_model = TIERED
    base_price: float = 0  # used when pricing_model = PER_KG
    per_kg_rate: float = 0  # used when pricing_model = PER_KG
    max_weight_kg: float = 20
    max_length_cm: float = 100
    max_width_cm: float = 100
    max_height_cm: float = 100
    accepted_types: List[PackageType] = []
    delivery_time_hours: int = 24
    features: List[str] = []  # e.g. ["insurance", "tracking", "fragile_handling", "signature_required"]
    images: List[str] = []
    status: str = "active"  # active | inactive | draft


class PackageServiceOfferingCreate(PackageServiceOfferingBase):
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


class PackageServiceOfferingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    pricing_model: Optional[PricingModel] = None
    tiers: Optional[List[WeightTier]] = None
    base_price: Optional[float] = None
    per_kg_rate: Optional[float] = None
    max_weight_kg: Optional[float] = None
    max_length_cm: Optional[float] = None
    max_width_cm: Optional[float] = None
    max_height_cm: Optional[float] = None
    accepted_types: Optional[List[PackageType]] = None
    delivery_time_hours: Optional[int] = None
    features: Optional[List[str]] = None
    images: Optional[List[str]] = None
    status: Optional[str] = None


class PackageContact(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str


class PackageDimensions(BaseModel):
    length_cm: float = 0
    width_cm: float = 0
    height_cm: float = 0


class PhysicalPackageCreate(BaseModel):
    """Create a physical shipment record (= booking against a package_service)"""
    package_service_id: Optional[str] = None  # references the operator's service offering
    sender: PackageContact
    receiver: PackageContact
    origin_city: str
    destination_city: str
    package_type: PackageType = PackageType.PARCEL
    weight_kg: float = 0
    dimensions: PackageDimensions = PackageDimensions()
    declared_value: float = 0
    description: Optional[str] = None
    notes: Optional[str] = None
    price: float = 0
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    estimated_delivery: Optional[str] = None
    carrier: Optional[str] = None
    customer_id: Optional[str] = None  # set by booking endpoint from authenticated user


class PhysicalPackageUpdate(BaseModel):
    """Update a physical shipment record. All fields optional."""
    sender: Optional[PackageContact] = None
    receiver: Optional[PackageContact] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    package_type: Optional[PackageType] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[PackageDimensions] = None
    declared_value: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None
    payment_status: Optional[PaymentStatus] = None
    status: Optional[PackageStatus] = None
    estimated_delivery: Optional[str] = None
    carrier: Optional[str] = None


class PhysicalPackage(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    tracking_number: str
    sender: PackageContact
    receiver: PackageContact
    origin_city: str
    destination_city: str
    package_type: PackageType = PackageType.PARCEL
    weight_kg: float = 0
    dimensions: PackageDimensions = PackageDimensions()
    declared_value: float = 0
    description: Optional[str] = None
    notes: Optional[str] = None
    price: float = 0
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    status: PackageStatus = PackageStatus.PENDING
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# Backwards-compat aliases used by other modules importing old names.
PackageServiceCreate = PhysicalPackageCreate
PackageServiceUpdate = PhysicalPackageUpdate
PackageService = PhysicalPackage
