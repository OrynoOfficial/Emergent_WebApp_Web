"""
Mobile Access Gate Middleware
─────────────────────────────
Salesforce-style "use the mobile app" gate. When the global setting
`mobile_access_policy == "mobile_only"`, this middleware blocks every
API request that smells like a phone/tablet web browser by returning
HTTP 426 Upgrade Required.

Bypass rules (intentional escape hatches):
  • Capacitor / native app sends header `X-Oryno-Client: mobile-app/<ver>`
  • Super-admin users (looked up via Bearer token) are always allowed
  • Public auth endpoints (`/api/auth/*`) and the policy endpoint itself
    must stay open so the frontend can still call them to log the user
    out and render the takeover
  • Non-API paths (HMR assets, /docs, …) are never gated here

The takeover UI lives on the frontend (`MobileAppGate.jsx`); this layer
is the *defense-in-depth* belt that stops users from bypassing the gate
by disabling JS or hand-crafting API calls.
"""
from __future__ import annotations

import re
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Routes the gate must NEVER block — otherwise users would be locked out
# of their own session.
_BYPASS_PREFIXES = (
    "/api/auth/",                                # login / logout / refresh / me
    "/api/system-settings/public/",              # gate itself reads the policy
    "/api/health",
)

# Heuristic — broad enough to catch every mainstream mobile browser, narrow
# enough to leave Capacitor/native WebViews (which set a custom UA) alone.
_MOBILE_UA = re.compile(
    r"(iPhone|iPad|iPod|Android|Mobile|Tablet|Silk|Opera Mini|Kindle|Mobi)",
    re.IGNORECASE,
)

# Capacitor / native app sends this header on every request. Update the
# version with each app release for analytics.
_NATIVE_CLIENT_HEADER = "x-oryno-client"
_NATIVE_CLIENT_TOKEN = "mobile-app"


def _looks_like_mobile_web(request: Request) -> bool:
    """Return True only for phone/tablet *web* browsers — not for the native
    Capacitor shell, not for desktop browsers."""
    native_client = (request.headers.get(_NATIVE_CLIENT_HEADER) or "").lower()
    if _NATIVE_CLIENT_TOKEN in native_client:
        return False
    ua = request.headers.get("user-agent", "")
    return bool(_MOBILE_UA.search(ua))


async def _resolve_policy() -> str:
    """Lazily import to avoid an import cycle with system_settings."""
    try:
        from routes.system_settings import get_mobile_access_policy
        return await get_mobile_access_policy()
    except Exception:
        return "hybrid"


async def _is_super_admin(request: Request) -> bool:
    """Best-effort lookup of the caller from the Bearer token. We *can't*
    reuse the `get_current_user` dependency here (we're outside the FastAPI
    request scope) so we decode the JWT manually and skip if anything is
    off — the gate must never crash legitimate traffic."""
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return False
    token = auth.split(" ", 1)[1].strip()
    try:
        from utils.auth import decode_token
        payload = decode_token(token)
        if not payload:
            return False
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return False
        from config.database import get_database
        db = get_database()
        if db is None:
            return False
        user = await db.users.find_one({"_id": user_id}, {"role": 1})
        return bool(user and user.get("role") == "super_admin")
    except Exception:
        return False


class MobileAccessGateMiddleware(BaseHTTPMiddleware):
    """Block phone/tablet web traffic when policy == 'mobile_only'."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path or ""

        # Out-of-scope paths short-circuit immediately.
        if not path.startswith("/api/"):
            return await call_next(request)
        if any(path.startswith(p) for p in _BYPASS_PREFIXES):
            return await call_next(request)

        policy = await _resolve_policy()
        if policy != "mobile_only":
            return await call_next(request)

        if not _looks_like_mobile_web(request):
            return await call_next(request)

        # Mobile web + mobile_only policy → only super-admins may pass.
        if await _is_super_admin(request):
            return await call_next(request)

        return JSONResponse(
            status_code=426,  # Upgrade Required
            content={
                "detail": "Oryno is mobile-app-only on phones and tablets. Please install the Oryno app.",
                "code": "mobile_app_required",
                "policy": policy,
            },
        )
