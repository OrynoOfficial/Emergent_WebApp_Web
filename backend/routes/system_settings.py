"""
System Settings API
Allows admin users to configure system-wide settings including session timeout
and the mobile-access policy (Salesforce-style "use the app" gate).
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
from uuid import uuid4
from config.database import get_database
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/system-settings", tags=["system-settings"])

# Constants
MIN_SESSION_TIMEOUT = 15  # 15 minutes minimum
MAX_SESSION_TIMEOUT = 120  # 2 hours maximum (as per user requirement)
DEFAULT_SESSION_TIMEOUT = 30  # 30 minutes default (as per user requirement)

# Mobile access policy values
#   hybrid      → phones/tablets may use the web app AND the native app (default; safe pre-launch)
#   mobile_only → phones/tablets are redirected to the native app store (Salesforce-style gate)
#   web_only    → emergency fallback: turn off the gate even when the apps exist
MOBILE_POLICY_VALUES = ("hybrid", "mobile_only", "web_only")
DEFAULT_MOBILE_POLICY = "hybrid"

# Pydantic Models
class SessionTimeoutSettings(BaseModel):
    session_timeout_minutes: int = Field(
        default=DEFAULT_SESSION_TIMEOUT,
        ge=MIN_SESSION_TIMEOUT,
        le=MAX_SESSION_TIMEOUT,
        description="Session timeout in minutes (15-120)"
    )

class SystemSettingsResponse(BaseModel):
    session_timeout_minutes: int
    min_session_timeout: int
    max_session_timeout: int
    mobile_access_policy: str = DEFAULT_MOBILE_POLICY
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class UpdateSettingsRequest(BaseModel):
    session_timeout_minutes: Optional[int] = Field(
        default=None,
        ge=MIN_SESSION_TIMEOUT,
        le=MAX_SESSION_TIMEOUT
    )


class UpdateMobilePolicyRequest(BaseModel):
    mobile_access_policy: Literal["hybrid", "mobile_only", "web_only"]


async def get_system_settings() -> dict:
    """Get current system settings from database"""
    db = get_database()
    settings = await db.system_settings.find_one({"_id": "global"})
    
    if not settings:
        # Create default settings if not exists
        default_settings = {
            "_id": "global",
            "session_timeout_minutes": DEFAULT_SESSION_TIMEOUT,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.system_settings.insert_one(default_settings)
        settings = default_settings
    
    return settings


async def get_session_timeout_minutes() -> int:
    """Get current session timeout in minutes"""
    settings = await get_system_settings()
    return settings.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT)


async def get_mobile_access_policy() -> str:
    """Get the current mobile access policy ('hybrid' | 'mobile_only' | 'web_only')."""
    settings = await get_system_settings()
    val = settings.get("mobile_access_policy", DEFAULT_MOBILE_POLICY)
    return val if val in MOBILE_POLICY_VALUES else DEFAULT_MOBILE_POLICY


@router.get("/", response_model=SystemSettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """
    Get system settings (accessible by admin and super_admin)
    """
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view system settings"
        )
    
    settings = await get_system_settings()
    
    return SystemSettingsResponse(
        session_timeout_minutes=settings.get("session_timeout_minutes", DEFAULT_SESSION_TIMEOUT),
        min_session_timeout=MIN_SESSION_TIMEOUT,
        max_session_timeout=MAX_SESSION_TIMEOUT,
        mobile_access_policy=settings.get("mobile_access_policy", DEFAULT_MOBILE_POLICY),
        updated_at=settings.get("updated_at"),
        updated_by=settings.get("updated_by_name")
    )


@router.put("/session-timeout")
async def update_session_timeout(
    request: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update session timeout setting (super_admin only)
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators can modify system settings"
        )
    
    if request.session_timeout_minutes is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_timeout_minutes is required"
        )
    
    # Validate range
    if request.session_timeout_minutes < MIN_SESSION_TIMEOUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session timeout cannot be less than {MIN_SESSION_TIMEOUT} minutes"
        )
    
    if request.session_timeout_minutes > MAX_SESSION_TIMEOUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session timeout cannot exceed {MAX_SESSION_TIMEOUT} minutes"
        )
    
    db = get_database()
    
    update_data = {
        "session_timeout_minutes": request.session_timeout_minutes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("_id"),
        "updated_by_name": current_user.get("full_name", current_user.get("email")),
    }
    
    await db.system_settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    # Log the activity
    await db.activity_logs.insert_one({
        "_id": str(uuid4()),
        "action": "settings.session_timeout.updated",
        "action_type": "update",
        "entity_type": "system_settings",
        "entity_id": "global",
        "entity_name": "Session Timeout",
        "details": f"Session timeout updated to {request.session_timeout_minutes} minutes",
        "user_id": current_user.get("_id"),
        "user_name": current_user.get("full_name"),
        "user_email": current_user.get("email"),
        "user_role": current_user.get("role"),
        "severity": "INFO",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "success": True,
        "message": f"Session timeout updated to {request.session_timeout_minutes} minutes",
        "session_timeout_minutes": request.session_timeout_minutes
    }


@router.get("/public/session-timeout")
async def get_public_session_timeout():
    """
    Get session timeout for login page (no auth required)
    This is needed for the frontend to know the session duration
    """
    timeout = await get_session_timeout_minutes()
    return {
        "session_timeout_minutes": timeout,
        "min_session_timeout": MIN_SESSION_TIMEOUT,
        "max_session_timeout": MAX_SESSION_TIMEOUT
    }


@router.put("/mobile-access-policy")
async def update_mobile_access_policy(
    request: UpdateMobilePolicyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the mobile-access policy. Super-admin only.

    Used by the Salesforce-style "use the app" gate. Values:
      - hybrid      → web + native both allowed (default)
      - mobile_only → phones/tablets on the web are blocked with an "install the app" takeover
      - web_only    → emergency disable of the gate
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators can modify the mobile access policy",
        )

    db = get_database()
    update_data = {
        "mobile_access_policy": request.mobile_access_policy,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("_id"),
        "updated_by_name": current_user.get("full_name", current_user.get("email")),
    }
    await db.system_settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True,
    )

    await db.activity_logs.insert_one({
        "_id": str(uuid4()),
        "action": "settings.mobile_access_policy.updated",
        "action_type": "update",
        "entity_type": "system_settings",
        "entity_id": "global",
        "entity_name": "Mobile Access Policy",
        "details": f"Mobile access policy changed to '{request.mobile_access_policy}'",
        "user_id": current_user.get("_id"),
        "user_name": current_user.get("full_name"),
        "user_email": current_user.get("email"),
        "user_role": current_user.get("role"),
        "severity": "INFO",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "success": True,
        "message": f"Mobile access policy set to '{request.mobile_access_policy}'",
        "mobile_access_policy": request.mobile_access_policy,
    }


@router.get("/public/mobile-access-policy")
async def get_public_mobile_access_policy():
    """Public read of the mobile-access policy.

    The frontend gate calls this on app boot (pre-login) so the takeover can fire
    even before the user has authenticated.
    """
    policy = await get_mobile_access_policy()
    return {"mobile_access_policy": policy}
