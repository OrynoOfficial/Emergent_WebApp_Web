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

Note: per-IP limits like these only protect against single-source bots. Real
account-takeover protection needs per-account locks (Redis-backed) + CAPTCHA
after N failures. Layer those in Phase 2.

The limiter respects `RATE_LIMIT_ENABLED=false` (env var) so test suites
running against the same in-process IP don't trip the protection.
"""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory limiter. Move to Redis once available:
#   limiter = Limiter(key_func=get_remote_address, storage_uri="redis://redis:6379/0")
_enabled = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() != "false"
limiter = Limiter(key_func=get_remote_address, enabled=_enabled)


# Convenience constants so the actual @limiter.limit decorators in route files
# stay readable and tunable from one place.
AUTH_LOGIN_RATE = "60/minute"
AUTH_REGISTER_RATE = "30/minute"
AUTH_PASSWORD_RESET_RATE = "10/minute"
AUTH_RESEND_RATE = "5/minute"
AUTH_VERIFY_RATE = "30/minute"
OTP_SEND_RATE = "5/minute"
OTP_VERIFY_RATE = "30/minute"
