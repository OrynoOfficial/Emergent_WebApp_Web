from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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
from routes.services import router as services_router
from routes.orders import router as orders_router
from routes.hotels import router as hotels_router
from routes.restaurants import router as restaurants_router
from routes.travel_routes import router as travel_routes_router
from routes.travel import router as travel_router
from routes.car_rental import router as car_rental_router
from routes.events import router as events_router
from routes.uploads import router as uploads_router
from routes.ratings import router as ratings_router
from routes.analytics import router as analytics_router
from config.database import connect_to_mongo, close_mongo_connection, get_database

# Import new management routes
from routes.vehicles import router as vehicles_router
from routes.operators import router as operators_router
from routes.seat_bookings import router as seat_bookings_router
from routes.rooms import router as rooms_router
from routes.commission import router as commission_router
from routes.loyalty import router as loyalty_router
from routes.promo_codes import router as promo_codes_router
from routes.employees import router as employees_router
from routes.validation import router as validation_router
from routes.activity_log import router as activity_log_router
from routes.events_management import router as events_management_router
from routes.pressing import router as pressing_router
from routes.banquets import router as banquets_router
from routes.cinema import router as cinema_router
from routes.packages import router as packages_router
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
from routes.operator_roles import router as operator_roles_router
from routes.document_templates import router as document_templates_router
from routes.database_management import router as database_management_router
from routes.otp import router as otp_router

# Create the main app
app = FastAPI(
    title="Oryno WebApp API",
    description="Backend API for Oryno service booking platform",
    version="1.0.0"
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CORS Configuration
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    origins = ["*"]
else:
    try:
        import json
        origins = json.loads(cors_origins) if cors_origins.startswith('[') else cors_origins.split(',')
    except Exception:
        origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(services_router)
app.include_router(orders_router)
app.include_router(hotels_router)
app.include_router(restaurants_router)
app.include_router(travel_routes_router)
app.include_router(travel_router)
app.include_router(car_rental_router)
app.include_router(events_router)
app.include_router(uploads_router)
app.include_router(ratings_router)
app.include_router(analytics_router)

# Include new management routers
app.include_router(vehicles_router)
app.include_router(operators_router)
app.include_router(seat_bookings_router)
app.include_router(rooms_router)
app.include_router(commission_router)
app.include_router(loyalty_router)
app.include_router(promo_codes_router)
app.include_router(employees_router)
app.include_router(events_management_router)
app.include_router(pressing_router)
app.include_router(banquets_router)
app.include_router(cinema_router)
app.include_router(packages_router)
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
app.include_router(operator_roles_router)  # Operator roles and permissions management
app.include_router(document_templates_router)  # HR Document templates
app.include_router(database_management_router)  # Database management GUI
app.include_router(otp_router)  # OTP verification (SMS & Email via Infobip)

# Legacy API endpoint for backwards compatibility
@app.get("/api/")
async def root():
    return {"message": "Oryno WebApp API", "version": "1.0.0"}
