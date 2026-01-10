from fastapi import APIRouter, HTTPException, status, Depends, Request
from models.user import UserCreate, UserLogin, User, Token, UserUpdate
from utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    generate_2fa_secret,
    verify_2fa_token,
    generate_2fa_qr_code,
    generate_phone_otp
)
from utils.geolocation import get_country_from_ip, get_location_data
from utils.email import send_verification_email, send_otp_email
from config.database import get_database
from middleware.auth import get_current_active_user
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate, request: Request):
    """Register a new user - Always assigns 'customer' role for self-registration"""
    db = get_database()
    
    # Validate that at least email or phone is provided
    is_phone_registration = user_data.email and '@phone.local' in user_data.email
    has_valid_email = user_data.email and '@phone.local' not in user_data.email
    has_phone = user_data.phone and len(user_data.phone.replace(" ", "").replace("-", "")) >= 9
    
    if not has_valid_email and not has_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a valid email address or phone number is required"
        )
    
    # Normalize phone number
    normalized_phone = None
    if user_data.phone:
        normalized_phone = user_data.phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Check if email already exists (only if real email is provided)
    if has_valid_email:
        existing_email = await db.users.find_one({"email": user_data.email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Check if phone number already exists
    if normalized_phone:
        existing_phone = await db.users.find_one({"phone": normalized_phone})
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )
    
    # Get IP and location data
    client_ip = request.client.host
    location_data = get_location_data(client_ip)
    
    # IMPORTANT: Self-registered users ALWAYS get 'customer' role
    # Operator accounts can only be created by admins/super_admins
    assigned_role = "customer"
    
    # Create user
    user = {
        "_id": str(uuid.uuid4()),
        "email": user_data.email if has_valid_email else None,
        "username": user_data.username or (user_data.email if has_valid_email else normalized_phone),
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "phone": normalized_phone,
        "role": assigned_role,  # Always customer for self-registration
        "status": "active",  # Allow login immediately
        "email_verified": False if has_valid_email else True,  # Phone registrations don't need email verification
        "phone_verified": has_phone and not has_valid_email,  # Assume phone is valid for phone-only registrations
        "registration_method": "email" if has_valid_email else "phone",
        "email_verification_token": str(uuid.uuid4()) if has_valid_email else None,
        "two_fa_enabled": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "ip_address": client_ip,
        "country": location_data.get("country_code"),
        "phone_country_code": location_data.get("country_code")
    }
    
    await db.users.insert_one(user)
    
    # Send verification email only for email registrations
    if has_valid_email:
        verification_link = f"http://localhost:3000/verify-email?token={user['email_verification_token']}"
        await send_verification_email(user["email"], verification_link)
        return {
            "message": "User registered successfully. Please check your email to verify your account.",
            "user_id": user["_id"],
            "requires_verification": True
        }
    
    # For phone-only registrations, user can login immediately
    return {
        "message": "User registered successfully. You can now login with your phone number.",
        "user_id": user["_id"],
        "requires_verification": False
    }

@router.post("/login")
async def login(credentials: UserLogin, request: Request):
    """Login user with email or phone number"""
    db = get_database()
    
    # Validate that at least one identifier is provided
    if not credentials.email and not credentials.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone number is required"
        )
    
    # Find user by email or phone
    user = None
    if credentials.email:
        user = await db.users.find_one({"email": credentials.email})
    elif credentials.phone:
        # Normalize phone number (remove spaces, dashes, etc.)
        phone = credentials.phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        # Try exact match first
        user = await db.users.find_one({"phone": phone})
        # If not found, try with regex for partial match (e.g., with or without country code)
        if not user:
            # Try matching the last 9 digits (common phone number length)
            phone_suffix = phone[-9:] if len(phone) >= 9 else phone
            user = await db.users.find_one({
                "phone": {"$regex": f".*{phone_suffix}$", "$options": "i"}
            })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password"
        )
    
    # Check if user is active
    if user["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    # Check 2FA
    if user.get("two_fa_enabled"):
        if not credentials.otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA code required"
            )
        
        if not verify_2fa_token(user["two_fa_secret"], credentials.otp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code"
            )
    
    # Update last login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Get dynamic session timeout from system settings
    from routes.system_settings import get_session_timeout_minutes
    session_timeout = await get_session_timeout_minutes()
    
    # Create tokens with dynamic timeout
    access_token = create_access_token(
        data={"sub": user["_id"], "email": user["email"]},
        timeout_minutes=session_timeout
    )
    refresh_token = create_refresh_token(data={"sub": user["_id"], "email": user["email"]})
    
    # Build operator context if user is assigned to an operator
    operator_context = None
    if user.get("operator_id"):
        operator = await db.operators.find_one({"_id": user["operator_id"]})
        if operator:
            operator_context = {
                "operator_id": operator["_id"],
                "operator_name": operator.get("name"),
                "operator_type": operator.get("operator_type"),
                "service_types": operator.get("service_types", []),
                "operator_role": user.get("operator_role"),
            }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "role": user.get("role"),
            "operator_context": operator_context,
        }
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request):
    """Refresh access token using refresh token"""
    from utils.auth import decode_token
    from pydantic import BaseModel
    
    class RefreshRequest(BaseModel):
        refresh_token: str
    
    db = get_database()
    
    try:
        body = await request.json()
        refresh_token_str = body.get("refresh_token")
        
        if not refresh_token_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refresh token required"
            )
        
        # Decode and validate refresh token
        payload = decode_token(refresh_token_str)
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        user = await db.users.find_one({"_id": user_id})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if user["status"] != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not active"
            )
        
        # Get dynamic session timeout from system settings
        from routes.system_settings import get_session_timeout_minutes
        session_timeout = await get_session_timeout_minutes()
        
        # Create new tokens with dynamic timeout
        access_token = create_access_token(
            data={"sub": user["_id"], "email": user["email"]},
            timeout_minutes=session_timeout
        )
        new_refresh_token = create_refresh_token(data={"sub": user["_id"], "email": user["email"]})
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

@router.post("/setup-2fa")
async def setup_2fa(current_user: dict = Depends(get_current_active_user)):
    """Setup 2FA for user"""
    db = get_database()
    
    # Generate secret
    secret = generate_2fa_secret()
    qr_code = generate_2fa_qr_code(secret, current_user["email"])
    
    # Store secret temporarily
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"two_fa_secret": secret, "two_fa_method": "authenticator"}}
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code
    }

@router.post("/verify-2fa")
async def verify_2fa(
    otp_code: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Verify and enable 2FA"""
    db = get_database()
    
    if not current_user.get("two_fa_secret"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not set up"
        )
    
    if not verify_2fa_token(current_user["two_fa_secret"], otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA code"
        )
    
    # Enable 2FA
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"two_fa_enabled": True}}
    )
    
    return {"message": "2FA enabled successfully"}

@router.get("/me", response_model=dict)
async def get_me(current_user: dict = Depends(get_current_active_user)):
    """Get current user info with operator context"""
    # Remove sensitive data
    user_data = current_user.copy()
    user_data.pop("password_hash", None)
    user_data.pop("two_fa_secret", None)
    user_data.pop("email_verification_token", None)
    user_data.pop("password_reset_token", None)
    
    # Convert _id to id for frontend
    if "_id" in user_data:
        user_data["id"] = user_data.pop("_id")
    
    # Include operator context and permissions
    user_data["operator_context"] = user_data.pop("_operator_context", None)
    user_data["effective_permissions"] = user_data.pop("_effective_permissions", [])
    
    return user_data

@router.post("/change-password")
async def change_password(
    request: Request,
    current_user: dict = Depends(get_current_active_user)
):
    """Change user password"""
    db = get_database()
    
    try:
        body = await request.json()
        current_password = body.get("current_password")
        new_password = body.get("new_password")
        
        if not current_password or not new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password and new password are required"
            )
        
        # Verify current password
        if not verify_password(current_password, current_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Validate new password length
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters"
            )
        
        # Update password
        new_hash = get_password_hash(new_password)
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
        )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )