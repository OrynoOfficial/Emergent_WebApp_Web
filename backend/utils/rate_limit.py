"""
Application-level rate limiting for high-risk endpoints (auth, password reset,
OTP, payment session creation).

Why SlowAPI?
  - Drops directly into Starlette/FastAPI via `app.state.limiter`.
  - Supports in-process (memory) or Redis-backed storage. We default to
    in-process because we don't yet have Redis; this protects a single pod
    perfectly well. Once Redis lands, swap `storage_uri` to `redis://…` and
    the same limits will apply cluster-wide.
  - Exposes a 429 with `Retry-After` so clients back off automatically.

Limit policy (defensive defaults — tune as we observe real traffic):
  - login           : 60/min/IP   — brute force protection (60 = 1/sec sustained, well above any human)
  - register        : 30/min/IP   — slows bot signups
  - password reset  : 10/min/IP   — slows enumeration
  - resend-invite   :  5/min/IP
  - verify-account  : 30/min/IP

Write endpoints (NEW — phase 5):
  - orders.create   : 30/min/user OR IP — 1 order every 2 sec sustained.
                      Blocks bots from spamming writes that drown Mongo +
                      Stripe webhooks. Idempotency-Key already de-dupes
                      same-key retries; this catches different-key floods.
  - payments.init   : 15/min/user OR IP — checkout sessions are expensive
                      to create (Stripe round-trip) and should NEVER be
                      requested faster than a human can click "Pay".
  - uploads         : 20/min/user OR IP — file uploads are I/O heavy; this
                      stops a malicious client from filling object storage.

Note: per-IP limits only protect against single-source bots. Real
account-takeover protection needs per-account locks (Redis-backed) + CAPTCHA
after N failures. Layer those in Phase 2.

The limiter respects `RATE_LIMIT_ENABLED=false` (env var) so test suites
running against the same in-process IP don't trip the protection.
"""
import os

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def user_or_ip_key(request: Request) -> str:
    """Best-of-both key function.

    For authenticated writes we want per-USER limits (so a corporate office
    sharing one IP isn't collectively rate-limited). When no token is
    present we fall back to the remote IP — preserves anonymous-burst
    protection on register / login etc.

    Robust to bad tokens: any decode error silently falls back to IP. The
    rate limiter MUST NOT crash a request even on malformed auth headers.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            from utils.auth import decode_token
            payload = decode_token(auth.split(" ", 1)[1])
            uid = payload.get("sub") if payload else None
            if uid:
                return f"u:{uid}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


# In-memory limiter today; once Redis is shared cluster-wide, set
# `storage_uri="redis://…"` so all pods share the same counters.
_enabled = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() != "false"
limiter = Limiter(
    key_func=get_remote_address,  # default key — IP-based (used by /auth/*)
    enabled=_enabled,
    storage_uri=os.environ.get("RATE_LIMIT_STORAGE", "memory://"),
    # Fail-open if the configured storage (e.g. Redis) becomes unreachable:
    # automatically fall back to in-process memory and swallow the connection
    # exception so requests still succeed. Critical for keeping /auth/login
    # alive when Redis is down — better to be slightly more permissive than
    # to return 500s to legitimate users.
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)


# Convenience constants so the actual @limiter.limit decorators in route files
# stay readable and tunable from one place.
AUTH_LOGIN_RATE = "60/minute"
AUTH_REGISTER_RATE = "30/minute"
AUTH_PASSWORD_RESET_RATE = "10/minute"
AUTH_RESEND_RATE = "5/minute"
AUTH_VERIFY_RATE = "30/minute"
OTP_SEND_RATE = "5/minute"
OTP_VERIFY_RATE = "30/minute"

# Phase-5 write endpoint limits — per-user when authenticated, per-IP otherwise.
WRITE_ORDER_RATE = "30/minute"
WRITE_PAYMENT_RATE = "15/minute"
WRITE_UPLOAD_RATE = "20/minute"
