from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class AccessLevel(str, Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"

class Permission(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    code: str  # Unique identifier like "travel.routes.create"
    description: Optional[str] = None
    module: str  # travel, hotel, restaurant, admin, etc.
    access_level: AccessLevel = AccessLevel.READ
    is_system: bool = False  # System permissions cannot be deleted
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class AccessGroup(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    permissions: List[str] = []  # List of permission codes
    is_system: bool = False  # System groups cannot be deleted
    operator_id: Optional[str] = None  # If set, group is operator-specific
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class AccessGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    operator_id: Optional[str] = None

class AccessGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

class UserAccess(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    access_group_id: str
    access_group_name: str
    operator_id: Optional[str] = None
    granted_by: str
    granted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        populate_by_name = True
