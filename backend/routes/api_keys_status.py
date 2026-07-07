"""
api_keys_status.py — read-only audit endpoint for admin/super_admin.

Lists every third-party API key present in the environment, returning:
  - key name (env var)
  - masked value (first 4 + last 4 chars, e.g. "sk_l****uvwx")
  - is_set (bool)
  - live/test detection (best-effort based on prefix)
  - last-validated timestamp + status (from cached ping)

Also exposes a per-key /validate endpoint that pings the provider to confirm
the key is still valid. Results are cached in `db.api_key_validations` for 24h.

Security notes:
  - Only admin / super_admin roles can read this endpoint.
  - Full key values NEVER leave the backend. Only masked previews are returned.
  - No editing endpoint is exposed here — keys live in .env for security reasons.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config.database import get_database
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/api-keys", tags=["admin", "api-keys"])


# Every integration key the platform relies on. `mask_visible` controls how many
# characters we surface at the start/end of the masked preview.
INTEGRATION_KEYS = [
    {"env": "STRIPE_SECRET_KEY", "provider": "Stripe", "purpose": "Card payments", "test_prefix": "sk_test_", "live_prefix": "sk_live_", "docs_url": "https://dashboard.stripe.com/apikeys"},
    {"env": "STRIPE_WEBHOOK_SECRET", "provider": "Stripe", "purpose": "Webhook signature verification", "test_prefix": "whsec_", "live_prefix": "whsec_", "docs_url": "https://dashboard.stripe.com/webhooks"},
    {"env": "STRIPE_PUBLISHABLE_KEY", "provider": "Stripe", "purpose": "Frontend card element", "test_prefix": "pk_test_", "live_prefix": "pk_live_", "docs_url": "https://dashboard.stripe.com/apikeys"},
    {"env": "RESEND_API_KEY", "provider": "Resend", "purpose": "Transactional email delivery", "test_prefix": "re_", "live_prefix": "re_", "docs_url": "https://resend.com/api-keys"},
    {"env": "RESEND_SENDER_EMAIL", "provider": "Resend", "purpose": "Verified sender address", "test_prefix": None, "live_prefix": None, "docs_url": "https://resend.com/domains"},
    {"env": "INFOBIP_API_KEY", "provider": "Infobip", "purpose": "SMS + email OTP", "test_prefix": None, "live_prefix": None, "docs_url": "https://portal.infobip.com/settings/accounts/api-keys"},
    {"env": "INFOBIP_BASE_URL", "provider": "Infobip", "purpose": "Infobip API base URL", "test_prefix": None, "live_prefix": None, "docs_url": "https://portal.infobip.com"},
    {"env": "EMERGENT_LLM_KEY", "provider": "Emergent Integrations", "purpose": "OpenAI/Anthropic/Gemini universal LLM key", "test_prefix": None, "live_prefix": None, "docs_url": "https://emergent.sh"},
    {"env": "MTN_MOMO_SUBSCRIPTION_KEY", "provider": "MTN MoMo", "purpose": "Primary subscription key", "test_prefix": None, "live_prefix": None, "docs_url": "https://momodeveloper.mtn.com"},
    {"env": "MTN_MOMO_API_USER", "provider": "MTN MoMo", "purpose": "API user identifier", "test_prefix": None, "live_prefix": None, "docs_url": "https://momodeveloper.mtn.com"},
    {"env": "MTN_MOMO_API_KEY", "provider": "MTN MoMo", "purpose": "API user key", "test_prefix": None, "live_prefix": None, "docs_url": "https://momodeveloper.mtn.com"},
    {"env": "MTN_MOMO_TARGET_ENVIRONMENT", "provider": "MTN MoMo", "purpose": "sandbox / mtncameroon", "test_prefix": None, "live_prefix": None, "docs_url": "https://momodeveloper.mtn.com"},
]


class APIKeyStatus(BaseModel):
    env: str
    provider: str
    purpose: str
    is_set: bool
    masked: str
    mode: str  # "live" | "test" | "unknown" | "not_set"
    docs_url: Optional[str] = None
    last_validated_at: Optional[str] = None
    last_validation_status: Optional[str] = None  # "ok" | "invalid" | "error" | None
    last_validation_message: Optional[str] = None


class APIKeyListResponse(BaseModel):
    keys: List[APIKeyStatus]
    generated_at: str


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


def _detect_mode(value: str, meta: dict) -> str:
    if not value:
        return "not_set"
    tp = meta.get("test_prefix")
    lp = meta.get("live_prefix")
    if lp and value.startswith(lp) and lp != tp:
        return "live"
    if tp and value.startswith(tp):
        # If test and live prefixes differ we already caught live above.
        # If they match (e.g. Resend's "re_"), default to unknown.
        if tp == lp:
            return "unknown"
        return "test"
    if lp and value.startswith(lp):
        return "live"
    return "unknown"


async def _require_admin(current_user: dict):
    role = current_user.get("role")
    if role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


async def _load_cached_validation(db, env: str) -> Optional[dict]:
    doc = await db.api_key_validations.find_one({"_id": env})
    if not doc:
        return None
    ts = doc.get("validated_at")
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(ts) if isinstance(ts, str) else ts
    except Exception:
        return None
    if datetime.now(timezone.utc) - parsed > timedelta(hours=24):
        return None
    return doc


@router.get("/", response_model=APIKeyListResponse)
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List every configured integration key with a masked preview + last-validation status."""
    await _require_admin(current_user)
    db = get_database()

    out: List[APIKeyStatus] = []
    for meta in INTEGRATION_KEYS:
        value = os.environ.get(meta["env"], "")
        cached = await _load_cached_validation(db, meta["env"])
        out.append(APIKeyStatus(
            env=meta["env"],
            provider=meta["provider"],
            purpose=meta["purpose"],
            is_set=bool(value),
            masked=_mask(value) if value else "",
            mode=_detect_mode(value, meta),
            docs_url=meta.get("docs_url"),
            last_validated_at=(cached or {}).get("validated_at"),
            last_validation_status=(cached or {}).get("status"),
            last_validation_message=(cached or {}).get("message"),
        ))

    return APIKeyListResponse(
        keys=out,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


async def _validate_stripe() -> tuple[str, str]:
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        return "invalid", "STRIPE_SECRET_KEY is not set"
    try:
        import stripe
        stripe.api_key = key
        # Lightweight probe: list 1 balance transaction. Auth failure raises AuthenticationError.
        stripe.Balance.retrieve()
        return "ok", "Stripe API key accepted"
    except Exception as e:
        return "invalid", f"Stripe rejected the key: {type(e).__name__}: {e}"


async def _validate_resend() -> tuple[str, str]:
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        return "invalid", "RESEND_API_KEY is not set"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {key}"},
            )
            if r.status_code == 200:
                return "ok", "Resend API key accepted"
            if r.status_code == 401:
                return "invalid", "Resend returned 401 Unauthorized"
            return "error", f"Resend returned HTTP {r.status_code}"
    except Exception as e:
        return "error", f"Resend probe failed: {type(e).__name__}: {e}"


async def _validate_infobip() -> tuple[str, str]:
    key = os.environ.get("INFOBIP_API_KEY")
    base = os.environ.get("INFOBIP_BASE_URL")
    if not key or not base:
        return "invalid", "INFOBIP_API_KEY or INFOBIP_BASE_URL is not set"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                f"{base.rstrip('/')}/account/1/accounts",
                headers={"Authorization": f"App {key}"},
            )
            # 401 = bad key; 403 = key OK but this endpoint restricted; 200 = OK
            if r.status_code in (200, 403):
                return "ok", "Infobip API key accepted"
            if r.status_code == 401:
                return "invalid", "Infobip returned 401 Unauthorized"
            return "error", f"Infobip returned HTTP {r.status_code}"
    except Exception as e:
        return "error", f"Infobip probe failed: {type(e).__name__}: {e}"


async def _validate_emergent_llm() -> tuple[str, str]:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return "invalid", "EMERGENT_LLM_KEY is not set"
    # No public validation endpoint — check format.
    if len(key) < 20:
        return "invalid", "Key appears too short — likely misconfigured"
    return "ok", "Key present (deep validation deferred to first actual LLM call)"


async def _validate_mtn_momo() -> tuple[str, str]:
    for var in ("MTN_MOMO_SUBSCRIPTION_KEY", "MTN_MOMO_API_USER", "MTN_MOMO_API_KEY"):
        if not os.environ.get(var):
            return "invalid", f"{var} is not set"
    return "ok", "MTN MoMo credentials present"


PROVIDER_VALIDATORS = {
    "Stripe": _validate_stripe,
    "Resend": _validate_resend,
    "Infobip": _validate_infobip,
    "Emergent Integrations": _validate_emergent_llm,
    "MTN MoMo": _validate_mtn_momo,
}


class ValidateResponse(BaseModel):
    provider: str
    status: str  # "ok" | "invalid" | "error"
    message: str
    validated_at: str


@router.post("/{provider}/validate", response_model=ValidateResponse)
async def validate_provider_key(provider: str, current_user: dict = Depends(get_current_user)):
    """Ping the third-party API to confirm the configured key is still valid.

    Providers: Stripe, Resend, Infobip, Emergent Integrations, MTN MoMo
    """
    await _require_admin(current_user)
    validator = PROVIDER_VALIDATORS.get(provider)
    if not validator:
        raise HTTPException(status_code=404, detail=f"Unknown provider '{provider}'")

    status_, message = await validator()
    now_iso = datetime.now(timezone.utc).isoformat()

    db = get_database()
    # Cache under each env var of this provider so the list endpoint can surface it
    envs = [k["env"] for k in INTEGRATION_KEYS if k["provider"] == provider]
    for env in envs:
        await db.api_key_validations.update_one(
            {"_id": env},
            {"$set": {"status": status_, "message": message, "validated_at": now_iso, "validated_by": current_user.get("_id")}},
            upsert=True,
        )

    return ValidateResponse(
        provider=provider,
        status=status_,
        message=message,
        validated_at=now_iso,
    )
