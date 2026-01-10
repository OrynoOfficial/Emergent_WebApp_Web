"""
OTP Routes for SMS and Email verification
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from config.database import get_database
from services.infobip_service import get_infobip_service, InfobipService
import time
import re

router = APIRouter(prefix="/api/otp", tags=["OTP Verification"])

# Simple in-memory rate limiting (replace with Redis in production)
rate_limit_store: Dict[str, list] = {}

class SendOTPRequest(BaseModel):
    phone_number: Optional[str] = None
    email: Optional[str] = None
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v):
        if v:
            # Remove spaces and dashes
            cleaned = re.sub(r'[\s\-\(\)]', '', v)
            if not cleaned.startswith('+'):
                raise ValueError('Phone number must start with + and country code')
            if not cleaned[1:].isdigit() or len(cleaned) < 10:
                raise ValueError('Invalid phone number format')
            return cleaned
        return v

class VerifyOTPRequest(BaseModel):
    phone_number: Optional[str] = None
    email: Optional[str] = None
    otp_code: str = Field(..., min_length=4, max_length=6)
    
    @field_validator('otp_code')
    @classmethod
    def validate_otp(cls, v):
        if not v.isdigit():
            raise ValueError('OTP must contain only digits')
        return v


async def check_rate_limit(identifier: str, max_requests: int = 3, window_seconds: int = 300):
    """Check if identifier has exceeded rate limit"""
    current_time = time.time()
    
    if identifier not in rate_limit_store:
        rate_limit_store[identifier] = []
    
    # Remove old requests outside the window
    rate_limit_store[identifier] = [
        req_time for req_time in rate_limit_store[identifier]
        if current_time - req_time < window_seconds
    ]
    
    if len(rate_limit_store[identifier]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait 5 minutes before trying again."
        )
    
    rate_limit_store[identifier].append(current_time)


@router.post("/send")
async def send_otp(request: SendOTPRequest):
    """Send OTP to phone number or email"""
    db = get_database()
    infobip = get_infobip_service()
    
    if not request.phone_number and not request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either phone_number or email is required"
        )
    
    identifier = request.phone_number or request.email
    
    # Check rate limit
    await check_rate_limit(identifier)
    
    # Generate OTP
    otp_code = InfobipService.generate_otp(6)
    
    # Send OTP via appropriate channel
    if request.phone_number:
        result = await infobip.send_sms_otp(request.phone_number, otp_code)
        channel = "sms"
    else:
        result = await infobip.send_email_otp(request.email, otp_code)
        channel = "email"
    
    if result["status"] != "success":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("message", "Failed to send OTP")
        )
    
    # Store OTP in database with TTL (use naive UTC for MongoDB compatibility)
    otp_record = {
        "identifier": identifier,
        "otp_code": otp_code,
        "channel": channel,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
        "attempts_left": 5,
        "verified": False
    }
    
    # Remove any existing unverified OTPs for this identifier
    await db.otps.delete_many({"identifier": identifier, "verified": False})
    
    # Insert new OTP
    await db.otps.insert_one(otp_record)
    
    # Create TTL index if it doesn't exist (expires documents automatically)
    try:
        await db.otps.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass  # Index may already exist
    
    return {
        "status": "success",
        "message": f"OTP sent to {channel}",
        "channel": channel,
        "expires_in_seconds": 300
    }


@router.post("/verify")
async def verify_otp(request: VerifyOTPRequest):
    """Verify OTP code"""
    db = get_database()
    
    if not request.phone_number and not request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either phone_number or email is required"
        )
    
    identifier = request.phone_number or request.email
    
    # Find the OTP record
    otp_record = await db.otps.find_one({
        "identifier": identifier,
        "verified": False
    })
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending OTP found. Please request a new one."
        )
    
    # Check if OTP has expired (use naive UTC for comparison with MongoDB)
    now_utc = datetime.utcnow()
    expires_at = otp_record["expires_at"]
    # Handle both timezone-aware and naive datetimes from MongoDB
    if hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is not None:
        expires_at = expires_at.replace(tzinfo=None)
    
    if now_utc > expires_at:
        await db.otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
    
    # Check if locked due to too many attempts
    if otp_record.get("locked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many failed attempts. Please request a new OTP."
        )
    
    # Check if OTP matches
    if otp_record["otp_code"] != request.otp_code:
        attempts_left = otp_record.get("attempts_left", 5) - 1
        
        if attempts_left > 0:
            await db.otps.update_one(
                {"_id": otp_record["_id"]},
                {"$set": {"attempts_left": attempts_left}}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {attempts_left} attempts remaining."
            )
        else:
            await db.otps.update_one(
                {"_id": otp_record["_id"]},
                {"$set": {"locked": True}}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please request a new OTP."
            )
    
    # Mark as verified
    await db.otps.update_one(
        {"_id": otp_record["_id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "status": "success",
        "message": "OTP verified successfully",
        "identifier": identifier,
        "channel": otp_record["channel"]
    }


@router.post("/resend")
async def resend_otp(request: SendOTPRequest):
    """Resend OTP - same as send but with resend tracking"""
    # Just call send_otp with same logic
    return await send_otp(request)
