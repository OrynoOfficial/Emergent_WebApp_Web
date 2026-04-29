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
    """Create a physical shipment record"""
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
