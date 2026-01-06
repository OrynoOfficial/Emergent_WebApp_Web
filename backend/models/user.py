from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    OPERATOR = "operator"
    SERVICE_PROVIDER = "service_provider"
    CUSTOMER = "customer"
    EMPLOYEE = "employee"


class OperatorUserRole(str, Enum):
    """Role within an operator organization"""
    OWNER = "owner"              # Original creator, cannot be removed
    LOCAL_ADMIN = "local_admin"  # Can manage operator's data and create local users
    LOCAL_USER = "local_user"    # Limited access to operator's data


# Role hierarchy for permission checks (higher index = more permissions)
ROLE_HIERARCHY = {
    UserRole.CUSTOMER: 0,
    UserRole.EMPLOYEE: 1,
    UserRole.SERVICE_PROVIDER: 2,
    UserRole.OPERATOR: 3,
    UserRole.ADMIN: 4,
    UserRole.SUPER_ADMIN: 5
}

# Operator role hierarchy
OPERATOR_ROLE_HIERARCHY = {
    OperatorUserRole.LOCAL_USER: 0,
    OperatorUserRole.LOCAL_ADMIN: 1,
    OperatorUserRole.OWNER: 2
}

def can_manage_role(manager_role: str, target_role: str) -> bool:
    """Check if a manager role can manage (suspend/edit) a target role"""
    manager_level = ROLE_HIERARCHY.get(manager_role, 0)
    target_level = ROLE_HIERARCHY.get(target_role, 0)
    return manager_level > target_level

class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"

class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    username: Optional[str] = None
    password_hash: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    phone_country_code: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER
    status: UserStatus = UserStatus.ACTIVE
    profile_picture: Optional[str] = None
    
    # Operator Assignment Fields (for operator-scoped users)
    operator_id: Optional[str] = None           # Which operator they belong to
    operator_name: Optional[str] = None         # Denormalized for convenience
    operator_role: Optional[str] = None         # "owner" | "local_admin" | "local_user"
    operator_type: Optional[str] = None         # Service type of the operator
    
    # Scoped Permissions (for local users within an operator)
    scoped_permissions: List[str] = []
    
    # Custom permissions (override role defaults)
    custom_permissions: List[str] = []
    
    # OAuth
    google_id: Optional[str] = None
    oauth_provider: Optional[str] = None
    
    # 2FA
    two_fa_enabled: bool = False
    two_fa_secret: Optional[str] = None
    two_fa_method: Optional[str] = None  # "authenticator" or "phone"
    
    # Email verification
    email_verified: bool = False
    email_verification_token: Optional[str] = None
    
    # Password reset
    password_reset_token: Optional[str] = None
    password_reset_expires: Optional[datetime] = None
    
    # Preferences
    language: str = "en"
    currency: str = "USD"
    timezone: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    ip_address: Optional[str] = None
    country: Optional[str] = None
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "johndoe",
                "full_name": "John Doe",
                "role": "customer"
            }
        }

class UserCreate(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    otp_code: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_picture: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None