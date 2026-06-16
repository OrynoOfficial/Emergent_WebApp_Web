from datetime import datetime, timedelta
from typing import Optional
import uuid
from jose import JWTError, jwt
from passlib.context import CryptContext
from config.settings import settings
import pyotp
import qrcode
import io
import base64

# Use simpler bcrypt configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    # Truncate password to 72 bytes if needed (bcrypt limitation)
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Truncate password to 72 bytes if needed (bcrypt limitation)
    if len(password.encode('utf-8')) > 72:
        password = password[:72]
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, timeout_minutes: Optional[int] = None) -> str:
    """Create a JWT access token

    Every access token carries a unique `jti` so it can be revoked server-side
    on logout (see `revoked_access_tokens` Mongo collection).
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    elif timeout_minutes:
        expire = datetime.utcnow() + timedelta(minutes=timeout_minutes)
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": to_encode.get("jti") or str(uuid.uuid4()),
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, family_id: Optional[str] = None, parent_jti: Optional[str] = None) -> dict:
    """Create a JWT refresh token + return the (token, jti, family_id) tuple so
    the caller can persist it in the `refresh_tokens` collection.

    Rotation rules (enforced in /api/auth/refresh):
      - Each refresh issues a new token in the SAME `family_id`.
      - The previous token is immediately marked `revoked_at`.
      - If a refresh token presented for use has `revoked_at` set already,
        the entire family is revoked (reuse-attack detection).
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())
    fam = family_id or str(uuid.uuid4())
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": jti,
        "family_id": fam,
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {
        "token": encoded_jwt,
        "jti": jti,
        "family_id": fam,
        "parent_jti": parent_jti,
        "expires_at": expire,
    }

def decode_token(token: str) -> dict:
    """Decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_2fa_secret() -> str:
    """Generate a secret for 2FA"""
    return pyotp.random_base32()

def verify_2fa_token(secret: str, token: str) -> bool:
    """Verify a 2FA token"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)

def generate_2fa_qr_code(secret: str, email: str) -> str:
    """Generate a QR code for 2FA setup"""
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=email, issuer_name="Oryno Platform")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_str = base64.b64encode(buffer.read()).decode()
    
    return f"data:image/png;base64,{img_str}"

def generate_phone_otp() -> str:
    """Generate a 6-digit OTP for phone verification"""
    import random
    return str(random.randint(100000, 999999))