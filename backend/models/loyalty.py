from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class LoyaltyTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"

class LoyaltyProgram(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    total_points: int = 0
    available_points: int = 0
    tier: LoyaltyTier = LoyaltyTier.BRONZE
    total_spent: float = 0
    total_bookings: int = 0
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    tier_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class LoyaltyTransaction(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    loyalty_program_id: str
    transaction_type: str  # earn, redeem, expire, bonus
    points: int
    description: str
    order_id: Optional[str] = None
    service_type: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class LoyaltyReward(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    points_required: int
    reward_type: str  # discount, free_service, upgrade, voucher
    reward_value: float  # Discount amount or percentage
    service_types: List[str] = []  # Applicable service types
    min_tier: LoyaltyTier = LoyaltyTier.BRONZE
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    max_redemptions: Optional[int] = None  # Per user
    total_available: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class LoyaltyRedemption(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    loyalty_program_id: str
    reward_id: str
    reward_name: str
    points_used: int
    order_id: Optional[str] = None
    status: str = "pending"  # pending, used, expired, cancelled
    code: str  # Redemption code
    expires_at: Optional[datetime] = None
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
