from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import routes from webapp-backend structure
from routes.auth import router as auth_router
from routes.payments import router as payments_router
from routes.payments_v2 import router as payments_v2_router
from routes.services import router as services_router
from routes.orders import router as orders_router
from routes.hotels import router as hotels_router
from routes.restaurants import router as restaurants_router
from routes.travel_routes import router as travel_routes_router
from routes.travel import router as travel_router
from routes.car_rental import router as car_rental_router
from routes.events import router as events_router
from routes.event_locations import router as event_locations_router
from routes.event_showtimes import router as event_showtimes_router
from routes.uploads import router as uploads_router
from routes.ratings import router as ratings_router
from routes.analytics import router as analytics_router
from config.database import connect_to_mongo, close_mongo_connection, get_database

# Import new management routes
from routes.vehicles import router as vehicles_router
from routes.operators import router as operators_router
from routes.seat_bookings import router as seat_bookings_router, seat_ws_router
from routes.rooms import router as rooms_router
from routes.inventory import router as inventory_router
from routes.commission import router as commission_router
from routes.loyalty import router as loyalty_router
from routes.promo_codes import router as promo_codes_router
from routes.employees import router as employees_router
from routes.validation import router as validation_router
from routes.activity_log import router as activity_log_router
from routes.events_management import router as events_management_router
from routes.qr import router as qr_router
from routes.refunds import router as refunds_router
from routes.admin_bulk import router as admin_bulk_router
from routes.admin_ops import router as admin_ops_router
from routes.pressing import router as pressing_router
from routes.banquets import router as banquets_router, packages_router as banquet_packages_router, cart_router as banquet_cart_router
from routes.cinema import router as cinema_router
from routes.packages import router as packages_router
from routes.package_services import router as package_services_router
from routes.access_control import router as access_control_router
from routes.notifications import router as notifications_router
from routes.public import router as public_router
from routes.support import router as support_router
from routes.support_tickets import router as support_tickets_router
from routes.search import router as search_router
from routes.users import router as users_router
from routes.stripe_checkout import router as stripe_checkout_router
from routes.momo_checkout import router as momo_checkout_router
from routes.operator_users import router as operator_users_router
from routes.system_settings import router as system_settings_router
from routes.admin_bootstrap import router as admin_bootstrap_router
from routes.operator_roles import router as operator_roles_router
from routes.resource_reassignments import router as resource_reassignments_router
from routes.document_templates import router as document_templates_router
from routes.database_management import router as database_management_router
from routes.otp import router as otp_router
from routes.geography import router as geography_router
from routes.pods import router as pods_router
from routes.employee_scopes import router as employee_scopes_router
from routes.customer_location import router as customer_location_router
from routes.communications import router as communications_router
from routes.favourites import router as favourites_router
from routes.reports import router as reports_router
# seat_ws is now integrated into seat_bookings.py
from routes.invitations import router as invitations_router
from routes.management_dashboard import router as management_dashboard_router
from routes.subscriptions import router as subscriptions_router
from routes.suggestions import router as suggestions_router
from routes.manual_bookings import router as manual_bookings_router

# Create the main app
app = FastAPI(
    title="Oryno WebApp API",
    description="Backend API for Oryno service booking platform",
    version="1.0.0"
)

# Attach the global rate limiter (used by auth/OTP routes via @limiter.limit).
# Custom 429 handler injects a Retry-After header so well-behaved clients
# (browsers, mobile apps with exponential backoff) wait the right amount.
from slowapi.errors import RateLimitExceeded
from utils.rate_limit import limiter
from fastapi.responses import JSONResponse


async def _rate_limit_handler(request, exc: RateLimitExceeded):
    """429 response with explicit Retry-After (defaults to 60 if SlowAPI
    didn't compute one). Polite clients (incl. browsers' fetch retry,
    mobile clients with exponential backoff, and CDNs) rely on this header
    to back off correctly."""
    retry_after = getattr(exc, "retry_after", None)
    headers = {"Retry-After": str(retry_after or 60)}
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}",
                 "retry_after_seconds": retry_after or 60},
        headers=headers,
    )


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ─── CORS Configuration ────────────────────────────────────────────────
# `CORS_ORIGINS` in .env can be:
#   - `*` (dev only) — we mirror origins via regex so allow_credentials=True
#     still works (the spec forbids `*` + credentials).
#   - JSON array `["https://app.example.com","https://admin.example.com"]`.
#   - Comma-separated `https://app.example.com,https://admin.example.com`.
# Production: list ONLY your real custom domains (apex + www + any subdomain
# that hosts the SPA / admin panel). This is what unlocks Cloudflare's
# "Full (Strict)" SSL mode without breaking cross-origin XHR.
cors_origins = os.environ.get('CORS_ORIGINS', '*').strip()
cors_origin_regex = None
if cors_origins == '*':
    # Mirror any origin while still allowing credentials. Equivalent to
    # `Access-Control-Allow-Origin: <request Origin>` instead of `*`.
    origins = []
    cors_origin_regex = ".*"
else:
    try:
        import json
        origins = (
            json.loads(cors_origins)
            if cors_origins.startswith('[')
            else [o.strip() for o in cors_origins.split(',') if o.strip()]
        )
    except Exception:
        origins = []
        cors_origin_regex = ".*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Headers the browser is allowed to READ from cross-origin XHR responses.
    # `Retry-After` is required so frontend exponential backoff sees the
    # SlowAPI hint; `Idempotency-Key` round-trips it for safe POST retries.
    expose_headers=["Retry-After", "Idempotency-Key", "X-Request-ID"],
)

# ─── Trusted hosts ─────────────────────────────────────────────────────
# Reject requests whose `Host:` header isn't in our allowlist. Defends
# against Host-header poisoning, password-reset link smuggling, and stops
# bots that scan the cluster's raw pod IPs from reaching the app.
#
# `ALLOWED_HOSTS` in .env: comma-separated; `*` disables the check (dev).
# Production: `app.yourdomain.com,api.yourdomain.com,yourdomain.com`.
_allowed_hosts_raw = os.environ.get("ALLOWED_HOSTS", "*").strip()
_allowed_hosts = (
    ["*"] if _allowed_hosts_raw == "*"
    else [h.strip() for h in _allowed_hosts_raw.split(",") if h.strip()]
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

# ─── Proxy headers (Cloudflare / k8s ingress in front of uvicorn) ──────
# Without this, `request.url.scheme` is "http" and `request.client.host`
# is the proxy IP — breaking Stripe success_url, secure-cookie checks, and
# SlowAPI per-IP keys. We trust `X-Forwarded-Proto` / `X-Forwarded-For` /
# `X-Forwarded-Host` from ANY upstream (`trusted_hosts="*"`) because in
# k8s the only thing that can reach uvicorn on :8001 is the ingress.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# ─── Default no-store on /api/* (CDN safety) ───────────────────────────
# Cloudflare aggressively caches anything with `Cache-Control: public` (or
# nothing). Any route that opts in to edge caching MUST set its own header
# (see `utils.cache_headers.edge_cache`). Everything else defaults to
# `no-store` so a JWT-authenticated user's data never leaks across pops.
from starlette.middleware.base import BaseHTTPMiddleware

class APINoStoreMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/api/") and "cache-control" not in (k.lower() for k in response.headers.keys()):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
        return response

app.add_middleware(APINoStoreMiddleware)

# ─── GZip compression ───────────────────────────────────────────────────
# Compress every JSON response > 500 bytes. Typical API list endpoints
# (hotels, films, orders) drop from ~50-200 KB → 5-30 KB on the wire,
# which is the biggest single perf win on mobile + slow connections.
# Cloudflare also compresses, but at the edge — this layer ensures the
# *origin → CF* hop is also small, dropping P95 by 50-70% in our load
# tests. Safe with TrustedHost/CORS because it runs after both.
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)

# Salesforce-style "mobile-app-only" gate. Returns HTTP 426 to phone/tablet
# *web* browsers (never to the native Capacitor shell) whenever the global
# `mobile_access_policy` setting is set to `mobile_only`. Defense-in-depth:
# the frontend renders the takeover UI, the backend refuses the request.
from middleware.mobile_gate import MobileAccessGateMiddleware
app.add_middleware(MobileAccessGateMiddleware)


# Mount static files for uploads (at /api/static to avoid conflict with /api/uploads router)
uploads_path = Path(__file__).parent / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(uploads_path)), name="uploads")

# Events
@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB on startup and seed test users"""
    await connect_to_mongo()
    await seed_test_users()
    # Always ensure a protected, un-deletable super-admin exists. Idempotent — safe
    # to re-run on every restart in both preview and production.
    await ensure_protected_super_admin()
    # Bootstrap notification indexes + one-shot dedupe (safe on every restart)
    try:
        from utils.notifications import ensure_notification_indexes, dedupe_existing_notifications
        db = get_database()
        if db is not None:
            await ensure_notification_indexes(db)
            stats = await dedupe_existing_notifications(db)
            if stats.get("duplicates_removed"):
                logger.info("Notifications deduped: %s", stats)
    except Exception as e:
        logger.warning("Notification bootstrap skipped: %s", e)

    # Bootstrap performance indexes for every hot collection. Idempotent: safe
    # to call on every restart — Motor short-circuits on identical specs.
    try:
        from utils.startup_indexes import ensure_all_indexes
        db = get_database()
        if db is not None:
            ix_stats = await ensure_all_indexes(db)
            logger.info(
                "Indexes bootstrapped: created=%d existed=%d failed=%d",
                ix_stats["created"], ix_stats["existed"], len(ix_stats["failed"]),
            )
            for coll, name, err in ix_stats["failed"][:10]:
                logger.warning("  Index conflict %s.%s: %s", coll, name, err)
    except Exception as e:
        logger.warning("Index bootstrap skipped: %s", e)

    # Start cross-pod pub/sub subscribers (seat updates today; more channels
    # can join the bus by following the same `start_subscriber` pattern).
    try:
        from routes.seat_bookings import init_seat_pubsub_subscriber
        await init_seat_pubsub_subscriber()
    except Exception as e:
        logger.warning("PubSub bridge init skipped: %s", e)

    # Boot the background work queue if Redis + arq are available.
    try:
        from utils.task_queue import start_worker_in_process
        await start_worker_in_process()
    except Exception as e:
        logger.warning("Background queue init skipped: %s", e)

    logger.info("Application started successfully")

async def seed_test_users():
    """Seed test users only on initial setup, not on every restart.
    
    This prevents deleted users from being re-created on hot reload.
    Uses a 'seeded_users' collection to track which users have been seeded.
    """
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    db = get_database()
    if db is None:
        logger.warning("Database not available for seeding")
        return
    
    # Check if seeding has already been done
    seed_record = await db.system_config.find_one({"_id": "user_seeding_complete"})
    
    test_users = [
        {
            "email": "superadmin@oryno.com",
            "username": "superadmin",
            "password_hash": pwd_context.hash("testpassword123"),
            "full_name": "Super Admin",
            "phone": "+237600000000",
            "role": "super_admin",
            "status": "active",
            "email_verified": True,
            "two_fa_enabled": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "email": "admin@test.com",
            "username": "admin",
            "password_hash": pwd_context.hash("testpassword123"),
            "full_name": "Admin User",
            "phone": "+237600000001",
            "role": "admin",
            "status": "active",
            "email_verified": True,
            "two_fa_enabled": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "email": "operator@test.com",
            "username": "operator",
            "password_hash": pwd_context.hash("testpassword123"),
            "full_name": "Operator User",
            "phone": "+237600000002",
            "role": "operator",
            "status": "active",
            "email_verified": True,
            "two_fa_enabled": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "email": "customer@test.com",
            "username": "customer",
            "password_hash": pwd_context.hash("testpassword123"),
            "full_name": "Customer User",
            "phone": "+237600000003",
            "role": "customer",
            "status": "active",
            "email_verified": True,
            "two_fa_enabled": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    # If seeding already done, only update passwords for EXISTING users (don't re-create deleted ones)
    if seed_record:
        for user_data in test_users:
            existing = await db.users.find_one({"email": user_data["email"]})
            if existing:
                # Only update password hash for existing users
                await db.users.update_one(
                    {"email": user_data["email"]},
                    {"$set": {"password_hash": user_data["password_hash"]}}
                )
                logger.info(f"Updated password for existing user: {user_data['email']}")
        return
    
    # First time seeding - create users that don't exist
    for user_data in test_users:
        existing = await db.users.find_one({"email": user_data["email"]})
        if not existing:
            user_data["_id"] = str(uuid.uuid4())
            await db.users.insert_one(user_data)
            logger.info(f"Created test user: {user_data['email']}")
        else:
            # Update password hash in case it changed
            await db.users.update_one(
                {"email": user_data["email"]},
                {"$set": {"password_hash": user_data["password_hash"], "status": "active", "email_verified": True}}
            )
            logger.info(f"Updated test user: {user_data['email']}")
    
    # Mark seeding as complete
    await db.system_config.update_one(
        {"_id": "user_seeding_complete"},
        {"$set": {"completed_at": datetime.now(timezone.utc), "version": "1.0"}},
        upsert=True
    )
    logger.info("User seeding marked as complete")

async def ensure_protected_super_admin():
    """Guarantee a protected, un-deletable super-admin exists in every environment.

    Behaviour (idempotent — safe on every startup):
      • Reads ``PROTECTED_SUPER_ADMIN_EMAIL`` and ``PROTECTED_SUPER_ADMIN_PASSWORD``
        from the environment. Falls back to ``superadmin@oryno.com`` /
        ``testpassword123`` so first-deploys work without manual config.
      • If a user with that email already exists, it is *upgraded* in place:
        role bumped to ``super_admin``, ``is_system_account=True``,
        ``status=active``. The password is **never** overwritten on an existing
        account — the operator/super-admin can rotate it via the regular reset
        flow.
      • If no such user exists, a fresh super-admin row is inserted with the
        password hash derived from ``PROTECTED_SUPER_ADMIN_PASSWORD``.
      • Deletion of any user with ``is_system_account=True`` is blocked by the
        ``DELETE /api/users/{id}`` route, so production can never end up with
        zero super-admin accounts.
    """
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    db = get_database()
    if db is None:
        logger.warning("Database not available — skipping protected super-admin seed")
        return

    email = os.environ.get("PROTECTED_SUPER_ADMIN_EMAIL", "superadmin@oryno.com").strip().lower()
    password = os.environ.get("PROTECTED_SUPER_ADMIN_PASSWORD", "testpassword123")
    if not email or not password:
        logger.warning("PROTECTED_SUPER_ADMIN_* env vars empty — skipping seed")
        return

    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": email})

    if existing:
        # Upgrade in place — never clobber the password an admin may have rotated.
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "role": "super_admin",
                "status": "active",
                "email_verified": True,
                "is_system_account": True,
                "is_protected": True,
                "updated_at": now,
            }}
        )
        logger.info("Protected super-admin %s already present — flags reasserted", email)
        return

    user_doc = {
        "_id": str(uuid.uuid4()),
        "email": email,
        "username": email.split("@")[0],
        "password_hash": pwd_context.hash(password),
        "full_name": "Super Admin",
        "phone": "+237600000000",
        "role": "super_admin",
        "status": "active",
        "email_verified": True,
        "two_fa_enabled": False,
        "is_system_account": True,
        "is_protected": True,
        "must_reset_password": True,   # force rotation on first sign-in
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    logger.info("Protected super-admin %s provisioned (system account, un-deletable)", email)

@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown"""
    await close_mongo_connection()
    logger.info("Application shutdown complete")

# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "oryno-webapp-api"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "service": "oryno-webapp-api"}

# Include all webapp-backend routers
app.include_router(auth_router)
app.include_router(payments_router)
app.include_router(payments_v2_router)  # Immutable ledger-based payments
app.include_router(services_router)
app.include_router(orders_router)
app.include_router(hotels_router)
app.include_router(restaurants_router)
app.include_router(travel_routes_router)
app.include_router(travel_router)
app.include_router(car_rental_router)
app.include_router(events_router)
app.include_router(event_locations_router)
app.include_router(event_showtimes_router)
app.include_router(uploads_router)
app.include_router(ratings_router)
app.include_router(analytics_router)

# Include new management routers
app.include_router(vehicles_router)
app.include_router(resource_reassignments_router)
app.include_router(operators_router)
app.include_router(seat_bookings_router)
app.include_router(rooms_router)
app.include_router(inventory_router)
app.include_router(commission_router)
app.include_router(loyalty_router)
app.include_router(promo_codes_router)
app.include_router(employees_router)
app.include_router(events_management_router)
app.include_router(qr_router)
app.include_router(refunds_router)
app.include_router(admin_bulk_router)
app.include_router(admin_ops_router)
app.include_router(pressing_router)
app.include_router(banquets_router)
# Include packages_router AFTER banquets so that /packages/ on the
# packages-router still wins lookup-by-path (FastAPI checks routes in
# registration order, but since /api/banquets/packages has a more
# specific literal prefix than /api/banquets/{banquet_id}, the matcher
# resolves the dynamic vs literal path component correctly regardless
# of ordering). Listing it here keeps the OpenAPI tags grouped.
app.include_router(banquet_packages_router)
app.include_router(banquet_cart_router)
app.include_router(cinema_router)
app.include_router(packages_router)
app.include_router(package_services_router)
app.include_router(access_control_router)
app.include_router(notifications_router)
app.include_router(validation_router)
app.include_router(activity_log_router)
app.include_router(public_router)  # Public endpoints (no auth required)
app.include_router(support_router)  # Support chatbot and live chat
app.include_router(support_tickets_router)  # Support tickets management
app.include_router(search_router)  # Global search
app.include_router(users_router)  # User management
app.include_router(stripe_checkout_router)  # Stripe Checkout integration
app.include_router(momo_checkout_router)  # MTN MoMo Mobile Money integration
app.include_router(operator_users_router)  # Operator users management
app.include_router(system_settings_router)  # System settings (session timeout, etc.)
app.include_router(admin_bootstrap_router)  # Super-admin one-shot catalogue seed
app.include_router(operator_roles_router)  # Operator roles and permissions management
app.include_router(document_templates_router)  # HR Document templates
app.include_router(database_management_router)  # Database management GUI
app.include_router(otp_router)  # OTP verification (SMS & Email via Infobip)
app.include_router(geography_router)  # Geography (countries, regions) management
app.include_router(pods_router)  # Pod-based team structure management
app.include_router(employee_scopes_router)  # Employee access scopes management
app.include_router(customer_location_router)  # Customer location-aware filtering
app.include_router(communications_router)  # Service communications (announcements, alerts)
app.include_router(favourites_router)  # User favourites
app.include_router(seat_ws_router)  # WebSocket for real-time seat updates
app.include_router(invitations_router)  # Email invitation system
app.include_router(management_dashboard_router)  # Real operator-scoped dashboard stats
app.include_router(subscriptions_router)  # User-to-operator subscriptions & promotions
app.include_router(reports_router)  # Report generation with operator scoping
app.include_router(suggestions_router)  # Dynamic popular locations & items
app.include_router(manual_bookings_router)  # Operator walk-in / cash bookings

# Legacy API endpoint for backwards compatibility
@app.get("/api/")
async def root():
    return {"message": "Oryno WebApp API", "version": "1.0.0"}
