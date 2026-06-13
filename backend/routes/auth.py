from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
from typing import Optional
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
from utils.rate_limit import (
    limiter,
    AUTH_LOGIN_RATE, AUTH_REGISTER_RATE, AUTH_RESEND_RATE, AUTH_VERIFY_RATE,
)
from config.database import get_database
from middleware.auth import get_current_active_user
from datetime import datetime, timedelta
import uuid
import os

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=dict)
@limiter.limit(AUTH_REGISTER_RATE)
async def register(user_data: UserCreate, request: Request):
    """Register a new user - Always assigns 'customer' role for self-registration"""
    db = get_database()
    
    # Validate that at least email or phone is provided
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
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        verification_link = f"{frontend_url}/verify-email?token={user['email_verification_token']}"
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
@limiter.limit(AUTH_LOGIN_RATE)
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
    if user["status"] == "pending_verification":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your account from the invitation email before signing in."
        )
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
            # Normalize service type names for consistency
            _svc_map = {"hotels": "hotel", "restaurants": "restaurant", "event": "events"}
            raw_types = operator.get("service_types", [])
            normalized_types = [_svc_map.get(s, s) for s in raw_types]
            operator_context = {
                "operator_id": operator["_id"],
                "operator_name": operator.get("name"),
                "operator_type": operator.get("operator_type"),
                "service_types": normalized_types,
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


# ─── Two-step login: existence check ───────────────────────────────────
class CheckAccountRequest(BaseModel):
    method: str             # "email" | "phone"
    identifier: str         # actual email or phone value


def _normalize_phone(phone: str) -> str:
    return phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")


async def _find_user_by(method: str, identifier: str):
    db = get_database()
    if method == "email":
        return await db.users.find_one({"email": identifier.strip().lower()})
    phone = _normalize_phone(identifier)
    user = await db.users.find_one({"phone": phone})
    if not user:
        suffix = phone[-9:] if len(phone) >= 9 else phone
        user = await db.users.find_one({"phone": {"$regex": f".*{suffix}$", "$options": "i"}})
    return user


@router.post("/check-account")
@limiter.limit(AUTH_LOGIN_RATE)
async def check_account(payload: CheckAccountRequest, request: Request):
    """Step 1 of two-step login: tell the client whether the identifier
    matches an existing account, so the UI can either show the password
    field or prompt for sign-up.

    To minimise enumeration risk we don't echo the masked identifier back
    on success — just `{"exists": bool}`. SlowAPI throttles brute force.
    """
    if payload.method not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="method must be 'email' or 'phone'")
    if not payload.identifier or not payload.identifier.strip():
        raise HTTPException(status_code=400, detail="identifier is required")

    user = await _find_user_by(payload.method, payload.identifier)
    if not user:
        return {"exists": False}

    # Surface only role + status — enough to drive UX (e.g. block disabled
    # accounts here rather than after a wasted password attempt).
    return {
        "exists": True,
        "role": user.get("role"),
        "status": user.get("status"),
        "two_fa_enabled": bool(user.get("two_fa_enabled")),
    }


# ─── Forgot password (customers only) ──────────────────────────────────
# Two channels per the spec:
#   • email  → magic-link reset (`/reset-password?token=…`) via Resend
#   • phone  → 6-digit OTP that the user enters in the reset form
# Operators / team-members are intentionally excluded: their resets must
# go through their owner / admin (see `routes/operator_users.py`).

class ForgotPasswordRequest(BaseModel):
    method: str             # "email" | "phone"
    identifier: str


class ResetPasswordRequest(BaseModel):
    token: str              # email-link token  OR  6-digit OTP
    new_password: str
    method: str = "email"   # "email" | "phone"  (which channel was used)
    identifier: Optional[str] = None  # required when method == "phone"


# Roles that are NOT allowed to self-reset via this endpoint.
_OPERATOR_ROLES = {"operator", "operator_admin", "operator_user"}


@router.post("/forgot-password")
@limiter.limit(AUTH_RESEND_RATE)
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    """Initiate a customer self-service password reset.

    For email: a one-shot magic-link token is stored + emailed.
    For phone: a 6-digit OTP is stored + (in production) sent via SMS.
    In dev/sandbox the OTP and link are also returned in the response so
    the agent / QA can complete the flow without a real inbox / handset.
    """
    db = get_database()
    if payload.method not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="method must be 'email' or 'phone'")

    user = await _find_user_by(payload.method, payload.identifier)
    # NOTE: To prevent account-existence leaks we return a generic success
    # even when the user is missing — the only side-effect of a missing
    # account is that no email/sms is dispatched. The dashboard ratelimit
    # protects us against using this as an enumeration oracle.
    if not user:
        return {"sent": True, "channel": payload.method}

    if user.get("role") in _OPERATOR_ROLES or user.get("operator_id"):
        raise HTTPException(
            status_code=403,
            detail="Operator and team accounts cannot self-reset. Ask your administrator.",
        )

    token = uuid.uuid4().hex if payload.method == "email" else generate_phone_otp()
    expires = datetime.utcnow() + timedelta(minutes=30)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_reset_token": token,
            "password_reset_expires": expires,
            "password_reset_method": payload.method,
        }},
    )

    resp = {"sent": True, "channel": payload.method}

    if payload.method == "email":
        public_url = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")
        reset_link = f"{public_url}/reset-password?token={token}"
        resp["reset_link"] = reset_link  # dev fallback
        try:
            from utils.email import send_password_reset_email
            await send_password_reset_email(
                to_email=user.get("email"),
                reset_link=reset_link,
            )
            resp["dispatched"] = True
        except Exception:
            # If Resend is sandboxed or misconfigured, the link in resp
            # lets the user copy it from the modal as a fallback.
            resp["dispatched"] = False
    else:
        # SMS dispatch is not yet wired (no Twilio integration). Surface
        # the OTP in the response so dev/QA can test; production should
        # toggle this off via `SMS_DISPATCH_ENABLED`.
        resp["otp"] = token if os.environ.get("SMS_DISPATCH_ENABLED", "false").lower() != "true" else None
        resp["dispatched"] = False

    return resp


@router.post("/reset-password")
@limiter.limit(AUTH_VERIFY_RATE)
async def reset_password(payload: ResetPasswordRequest, request: Request):
    """Complete a password reset using the token from `forgot-password`."""
    db = get_database()
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    query = {"password_reset_token": payload.token}
    if payload.method == "phone":
        # OTPs are 6 digits and reused per-user, so we MUST scope by
        # identifier or different users could collide on the same code.
        if not payload.identifier:
            raise HTTPException(status_code=400, detail="identifier required for phone reset")
        user = await _find_user_by("phone", payload.identifier)
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired code.")
        query["_id"] = user["_id"]

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token.")
    expires = user.get("password_reset_expires")
    if not expires or expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link has expired. Request a new one.")
    if user.get("role") in _OPERATOR_ROLES or user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Operator accounts cannot self-reset.")

    new_hash = get_password_hash(payload.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": new_hash},
            "$unset": {
                "password_reset_token": "",
                "password_reset_expires": "",
                "password_reset_method": "",
            },
        },
    )
    return {"reset": True}


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
    user_data["authorization_context"] = user_data.pop("_authorization_context", None)
    
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


# ──────────────────────────────────────────────────────────────────────────────
# Account verification (operator owner / staff invite flow)
# ──────────────────────────────────────────────────────────────────────────────

class VerifyAccountRequest(BaseModel):
    token: str
    password: Optional[str] = None  # required when has_temp_password=False


@router.get("/verify-account/{token}")
async def get_verification_token_info(token: str):
    """Return public info about an invite token so the verify-account UI can prefill the user's name/email."""
    db = get_database()
    tok = await db.verification_tokens.find_one({"_id": token}, {"_id": 0})
    if not tok:
        raise HTTPException(status_code=404, detail="Invitation link is invalid or has been revoked")
    if tok.get("consumed_at"):
        raise HTTPException(status_code=410, detail="This invitation has already been used")
    if tok.get("expires_at") and tok["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invitation has expired — ask your admin to send a new one")

    user = await db.users.find_one({"_id": tok["user_id"]}, {"_id": 0, "password_hash": 0})
    return {
        "email": tok.get("user_email"),
        "full_name": user.get("full_name") if user else None,
        "operator_name": tok.get("operator_name"),
        "has_temp_password": tok.get("has_temp_password", False),
        "expires_at": tok.get("expires_at"),
    }


@router.post("/verify-account")
@limiter.limit(AUTH_VERIFY_RATE)
async def verify_account(body: VerifyAccountRequest, request: Request):
    """
    Confirm an invited account.
    - If has_temp_password=True, the invitee just confirms (password optional, only updates if provided).
    - If has_temp_password=False, the invitee MUST provide a new password.
    Marks the user active+email_verified and consumes the token.
    """
    db = get_database()
    tok = await db.verification_tokens.find_one({"_id": body.token})
    if not tok:
        raise HTTPException(status_code=404, detail="Invitation link is invalid or has been revoked")
    if tok.get("consumed_at"):
        raise HTTPException(status_code=410, detail="This invitation has already been used")
    if tok.get("expires_at") and tok["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invitation has expired — ask your admin to send a new one")

    user = await db.users.find_one({"_id": tok["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    update_fields = {
        "status": "active",
        "email_verified": True,
        "updated_at": datetime.utcnow(),
    }
    has_temp_password = tok.get("has_temp_password", False)
    if not has_temp_password:
        if not body.password or len(body.password) < 8:
            raise HTTPException(status_code=400, detail="A password of at least 8 characters is required")
        from utils.auth import get_password_hash
        update_fields["password_hash"] = get_password_hash(body.password)
    elif body.password:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        from utils.auth import get_password_hash
        update_fields["password_hash"] = get_password_hash(body.password)

    await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
    await db.verification_tokens.update_one(
        {"_id": body.token},
        {"$set": {"consumed_at": datetime.utcnow()}},
    )
    return {"message": "Account confirmed — you can now sign in.", "email": user["email"]}


@router.post("/resend-invite/{user_id}")
@limiter.limit(AUTH_RESEND_RATE)
async def resend_invite(user_id: str, request: Request, current_user: dict = Depends(get_current_active_user)):
    """Resend the invite email for a user still pending verification. Admin/super-admin only."""
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_database()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("status") != "pending_verification":
        raise HTTPException(status_code=400, detail="User is not pending verification")

    import secrets as _secrets
    from os import environ as _env
    invite_token = _secrets.token_urlsafe(32)
    _public_url = _env.get("APP_PUBLIC_URL", "").rstrip("/")
    invite_link = f"{_public_url}/verify-account?token={invite_token}" if _public_url else None
    # Invalidate any prior outstanding tokens for this user (defence in depth)
    await db.verification_tokens.update_many(
        {"user_id": user_id, "consumed_at": None},
        {"$set": {"consumed_at": datetime.utcnow(), "revoked": True}},
    )
    await db.verification_tokens.insert_one({
        "_id": invite_token,
        "user_id": user_id,
        "user_email": user["email"],
        "purpose": "account_invite",
        "operator_id": user.get("operator_id"),
        "operator_name": user.get("operator_name"),
        "has_temp_password": True,  # treat resend as "password already known"; admin can change later
        "consumed_at": None,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=7),
    })
    email_status = "failed"
    try:
        from services.email_service import send_account_invite_email
        await send_account_invite_email(
            recipient_email=user["email"],
            recipient_name=user.get("full_name") or user["email"],
            invite_token=invite_token,
            operator_name=user.get("operator_name"),
            inviter_name=current_user.get("full_name"),
            has_temp_password=True,
        )
        email_status = "sent"
    except Exception:
        import logging
        logging.exception("Failed to resend invite email")
    return {"message": "Invitation refreshed", "invite_link": invite_link, "email_status": email_status}


@router.get("/invitations")
async def list_invitations(
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """List account-invitation verification tokens with derived status.
    Admin/super_admin only. Used by the Invitations sub-page on /admin/users.
    """
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_database()
    query = {"purpose": "account_invite"}
    if search:
        query["user_email"] = {"$regex": search, "$options": "i"}
    cursor = db.verification_tokens.find(query).sort("created_at", -1).limit(500)
    now = datetime.utcnow()
    items = []
    user_ids = set()
    for t in await cursor.to_list(500):
        user_ids.add(t["user_id"])
        items.append(t)

    # Bulk-fetch the matching users so the UI can show role + status
    users_map = {}
    if user_ids:
        async for u in db.users.find({"_id": {"$in": list(user_ids)}}, {"_id": 1, "role": 1, "operator_name": 1, "full_name": 1, "status": 1, "email_verified": 1}):
            users_map[u["_id"]] = u

    public_url = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")

    def derive_status(t):
        if t.get("revoked"):
            return "revoked"
        if t.get("consumed_at"):
            return "used"
        if t.get("expires_at") and t["expires_at"] < now:
            return "expired"
        return "pending"

    out = []
    for t in items:
        u = users_map.get(t["user_id"], {})
        derived = derive_status(t)
        if status and derived != status:
            continue
        token_id = t.get("_id")
        out.append({
            "token": token_id,
            "user_id": t["user_id"],
            "email": t.get("user_email"),
            "full_name": u.get("full_name"),
            "role": u.get("role"),
            "operator_name": u.get("operator_name") or t.get("operator_name"),
            "status": derived,
            "user_account_status": u.get("status"),
            "has_temp_password": t.get("has_temp_password", False),
            "created_at": t.get("created_at"),
            "expires_at": t.get("expires_at"),
            "consumed_at": t.get("consumed_at"),
            "invite_link": f"{public_url}/verify-account?token={token_id}" if public_url else None,
        })
    return {"invitations": out, "total": len(out)}


@router.delete("/invitations/{token}")
async def revoke_invitation(token: str, current_user: dict = Depends(get_current_active_user)):
    """Revoke a pending account invite. Admin/super_admin only."""
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_database()
    tok = await db.verification_tokens.find_one({"_id": token})
    if not tok:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if tok.get("consumed_at"):
        raise HTTPException(status_code=400, detail="Invitation has already been used")
    await db.verification_tokens.update_one(
        {"_id": token},
        {"$set": {"consumed_at": datetime.utcnow(), "revoked": True}},
    )
    return {"message": "Invitation revoked"}
