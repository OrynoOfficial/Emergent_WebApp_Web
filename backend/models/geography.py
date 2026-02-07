"""
Geography Models for Attribute-Based Operator Classification
Supports hierarchical Country > Region structure
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class Country(BaseModel):
    """Country entity for operator/employee scoping"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # ISO 3166-1 alpha-2 (e.g., "CM" for Cameroon)
    name: str
    continent: str = "Africa"
    currency_code: str = "XAF"  # Default to Central African CFA
    phone_code: str = "+237"
    timezone: str = "Africa/Douala"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class Region(BaseModel):
    """Region entity (belongs to a country)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    country_id: str
    country_code: str  # Denormalized for quick lookup
    code: str  # e.g., "CM-CE" for Centre Region, Cameroon
    name: str
    capital_city: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class MarketSegment(str, Enum):
    """Market segment classification for operators"""
    SME = "sme"              # Small and Medium Enterprises
    ENTERPRISE = "enterprise"  # Large enterprises
    STRATEGIC = "strategic"    # High-value strategic partners


class CountryCreate(BaseModel):
    code: str
    name: str
    continent: str = "Africa"
    currency_code: str = "XAF"
    phone_code: str = "+237"
    timezone: str = "Africa/Douala"


class CountryUpdate(BaseModel):
    name: Optional[str] = None
    continent: Optional[str] = None
    currency_code: Optional[str] = None
    phone_code: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class RegionCreate(BaseModel):
    country_id: str
    code: str
    name: str
    capital_city: Optional[str] = None


class RegionUpdate(BaseModel):
    name: Optional[str] = None
    capital_city: Optional[str] = None
    is_active: Optional[bool] = None
