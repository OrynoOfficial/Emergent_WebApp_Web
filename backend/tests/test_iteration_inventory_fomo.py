"""End-to-end tests for AlmostSoldOutBadge inventory enrichment.

Validates:
- GET /api/hotels/ exposes `available_rooms` aggregated from rooms collection.
- GET /api/restaurants/ exposes `tables_available` derived from total_tables
  minus today's confirmed orders.
"""
import asyncio
import os
import uuid
from datetime import datetime

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


def _load_base_url():
    val = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not val:
        try:
            with open("/app/frontend/.env") as fh:
                for line in fh:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        val = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return val.rstrip("/")


BASE_URL = _load_base_url()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "oryno_webapp"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_hotels_listing_exposes_available_rooms():
    """Hotels listing should sum available_rooms across all active rooms."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    hotel_id = f"test-hotel-{uuid.uuid4()}"
    operator_tag = f"op-fomo-{uuid.uuid4()}"
    rooms_payload = [
        {
            "_id": f"room-{uuid.uuid4()}",
            "hotel_id": hotel_id,
            "room_type": "Standard",
            "base_price": 30000,
            "total_rooms": 10,
            "available_rooms": 6,
            "is_active": True,
        },
        {
            "_id": f"room-{uuid.uuid4()}",
            "hotel_id": hotel_id,
            "room_type": "Suite",
            "base_price": 80000,
            "total_rooms": 4,
            "available_rooms": 3,
            "is_active": True,
        },
    ]
    hotel_payload = {
        "_id": hotel_id,
        "name": "FOMO Test Hotel",
        "city": "Douala",
        "country": "Cameroon",
        "is_active": True,
        "average_rating": 4.5,
        "operator_id": operator_tag,
        "created_at": datetime.utcnow(),
    }

    try:
        _run(db.hotels.insert_one(hotel_payload))
        _run(db.rooms.insert_many(rooms_payload))

        r = requests.get(f"{BASE_URL}/api/hotels/?operator_id={operator_tag}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        hotels = [h for h in data.get("hotels", []) if h["id"] == hotel_id]
        assert len(hotels) == 1, f"Hotel not found: {data}"
        h = hotels[0]
        assert "available_rooms" in h, "available_rooms missing"
        assert h["available_rooms"] == 9, f"Expected 9 (6+3), got {h['available_rooms']}"
        assert h["price_per_night"] == 30000
    finally:
        _run(db.hotels.delete_one({"_id": hotel_id}))
        _run(db.rooms.delete_many({"hotel_id": hotel_id}))


def test_restaurants_listing_exposes_tables_available_after_booking():
    """Restaurants listing should subtract today's confirmed orders from total_tables."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    restaurant_id = f"test-restaurant-{uuid.uuid4()}"
    operator_tag = f"op-fomo-r-{uuid.uuid4()}"
    restaurant = {
        "_id": restaurant_id,
        "name": "FOMO Test Bistro",
        "city": "Yaoundé",
        "country": "Cameroon",
        "cuisine_type": "French",
        "total_tables": 12,
        "is_active": True,
        "operator_id": operator_tag,
        "created_at": datetime.utcnow(),
    }
    today_iso = datetime.utcnow().strftime("%Y-%m-%d")
    orders = [
        {
            "_id": f"order-{uuid.uuid4()}",
            "service_type": "restaurant",
            "service_id": restaurant_id,
            "status": "confirmed",
            "booking_details": {"date": today_iso, "guests": 2},
            "created_at": datetime.utcnow(),
        }
        for _ in range(5)
    ]
    # One cancelled order — should NOT reduce availability
    orders.append({
        "_id": f"order-{uuid.uuid4()}",
        "service_type": "restaurant",
        "service_id": restaurant_id,
        "status": "cancelled",
        "booking_details": {"date": today_iso, "guests": 2},
        "created_at": datetime.utcnow(),
    })

    try:
        _run(db.restaurants.insert_one(restaurant))
        _run(db.orders.insert_many(orders))

        r = requests.get(f"{BASE_URL}/api/restaurants/?operator_id={operator_tag}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        results = [x for x in data.get("restaurants", []) if x["id"] == restaurant_id]
        assert len(results) == 1, f"Restaurant not found: {data}"
        rest = results[0]
        assert "tables_available" in rest, "tables_available missing"
        # 12 total - 5 confirmed today = 7
        assert rest["tables_available"] == 7, f"Expected 7, got {rest['tables_available']}"
    finally:
        _run(db.restaurants.delete_one({"_id": restaurant_id}))
        _run(db.orders.delete_many({"service_id": restaurant_id}))


def test_restaurants_tables_available_omitted_when_total_tables_missing():
    """Restaurants without total_tables should NOT receive a tables_available field."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    restaurant_id = f"test-restaurant-{uuid.uuid4()}"
    operator_tag = f"op-fomo-u-{uuid.uuid4()}"
    restaurant = {
        "_id": restaurant_id,
        "name": "Unscoped",
        "city": "Yaoundé",
        "country": "Cameroon",
        "is_active": True,
        "operator_id": operator_tag,
        "created_at": datetime.utcnow(),
        # No total_tables field
    }
    try:
        _run(db.restaurants.insert_one(restaurant))
        r = requests.get(f"{BASE_URL}/api/restaurants/?operator_id={operator_tag}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        results = [x for x in data.get("restaurants", []) if x["id"] == restaurant_id]
        assert len(results) == 1
        assert "tables_available" not in results[0]
    finally:
        _run(db.restaurants.delete_one({"_id": restaurant_id}))
