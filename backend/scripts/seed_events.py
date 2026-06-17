"""
Seed a few realistic Event SHOWTIMES into the dev DB.

Why this exists:
  - The legacy `events` collection has been retired. Customer-facing event
    discovery now reads from `event_showtimes` (each tied to a row in
    `event_locations`). This script wipes any leftover legacy `events` rows
    AND inserts 3 production-shape showtimes + their parent locations so the
    EventBooking / ShowtimeDetails regression flow has data to chew on.

Run:  cd /app/backend && python -m scripts.seed_events
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings


SEED = [
    {
        "location": {
            "name": "Palais des Sports",
            "city": "Douala",
            "address": "Palais des Sports, Bonanjo",
            "country": "Cameroon",
            "capacity": 5000,
        },
        "showtime": {
            "title": "Afrobeat Festival 2026",
            "description": "Top Afrobeats acts live in Douala — three stages, food trucks, after-party.",
            "event_type": "festival",
            "days_out": 21,
            "duration_hours": 5,
            "doors_open_at": "18:00",
            "tags": ["music", "festival", "afrobeats"],
            "poster_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200",
            "classes": [
                {"name": "General Admission", "price": 15000, "total_units": 2000, "description": "Standing pit"},
                {"name": "VIP",                "price": 35000, "total_units":  300, "description": "Seated, dedicated bar"},
                {"name": "VIP Box",            "price": 75000, "total_units":   50, "description": "Private box, 6 seats"},
            ],
        },
    },
    {
        "location": {
            "name": "Hilton Yaoundé Conference Hall",
            "city": "Yaoundé",
            "address": "Hilton Hotel, Boulevard du 20 Mai",
            "country": "Cameroon",
            "capacity": 1200,
        },
        "showtime": {
            "title": "TechSummit Yaoundé",
            "description": "Two-day startup summit — pitch day, fireside chats, investor matchmaking.",
            "event_type": "conference",
            "days_out": 35,
            "duration_hours": 9,
            "doors_open_at": "08:30",
            "tags": ["tech", "startup", "conference"],
            "poster_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200",
            "classes": [
                {"name": "Early Bird", "price": 25000, "total_units": 400, "description": "Conference access"},
                {"name": "Standard",   "price": 40000, "total_units": 600, "description": "All access + lunch"},
                {"name": "Investor",   "price":100000, "total_units":  80, "description": "Pitch room + dinner"},
            ],
        },
    },
    {
        "location": {
            "name": "Centre Culturel Bafoussam",
            "city": "Bafoussam",
            "address": "Avenue de la Liberté, Bafoussam",
            "country": "Cameroon",
            "capacity": 800,
        },
        "showtime": {
            "title": "Bafoussam Comedy Night",
            "description": "Stand-up comedy with five local headliners. 18+ only.",
            "event_type": "comedy",
            "days_out": 14,
            "duration_hours": 3,
            "doors_open_at": "20:00",
            "tags": ["comedy", "night"],
            "poster_url": "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=1200",
            "classes": [
                {"name": "Floor",   "price":  8000, "total_units": 400, "description": "Standing"},
                {"name": "Balcony", "price": 12000, "total_units": 200, "description": "Reserved seat"},
            ],
        },
    },
]


def _hydrate_classes(classes):
    """Mirror routes/event_showtimes._hydrate_classes — give each class an id +
    `available_units`. We deliberately leave them fully unbooked so QA flows
    can buy tickets."""
    out = []
    for c in classes:
        total = int(c["total_units"])
        out.append({
            "_id": str(uuid4()),
            "name": c["name"],
            "price": int(c["price"]),
            "total_units": total,
            "available_units": total,
            "description": c.get("description") or None,
        })
    return out


async def main():
    load_dotenv("/app/backend/.env")
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.effective_db_name]

    # 1. Clean up any leftover legacy `events` rows (the old script wrote
    # rows directly into this collection; it's now retired).
    legacy_count = await db.events.count_documents({})
    if legacy_count:
        res = await db.events.delete_many({})
        print(f"✓ Removed {res.deleted_count} legacy `events` rows.")

    # 2. Pick (or tag) an operator that supports events.
    op = await db.operators.find_one({"service_types": "events"})
    if not op:
        op = await db.operators.find_one({})
        if op:
            await db.operators.update_one(
                {"_id": op["_id"]},
                {"$addToSet": {"service_types": "events"}},
            )
    if not op:
        print("⚠  No operators in the DB — seed operators first.")
        return

    operator_id = op["_id"]
    operator_name = op.get("name") or "Oryno Events"
    now = datetime.now(timezone.utc)

    inserted_locs = 0
    inserted_showtimes = 0
    skipped = 0
    for spec in SEED:
        loc_spec = spec["location"]
        st_spec = spec["showtime"]

        # Find or create the location (idempotent by name+operator).
        location = await db.event_locations.find_one({
            "name": loc_spec["name"],
            "operator_id": operator_id,
        })
        if not location:
            location = {
                "_id": str(uuid4()),
                "operator_id": operator_id,
                "operator_name": operator_name,
                "name": loc_spec["name"],
                "city": loc_spec["city"],
                "address": loc_spec["address"],
                "country": loc_spec["country"],
                "capacity": loc_spec["capacity"],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            await db.event_locations.insert_one(location)
            inserted_locs += 1

        # Skip if a showtime with this title already exists for this location.
        existing = await db.event_showtimes.find_one({
            "title": st_spec["title"],
            "location_id": location["_id"],
        })
        if existing:
            skipped += 1
            continue

        start = now + timedelta(days=st_spec["days_out"], hours=2)
        end = start + timedelta(hours=st_spec["duration_hours"])
        showtime = {
            "_id": str(uuid4()),
            "location_id": location["_id"],
            "location_name": location["name"],
            "location_city": location["city"],
            "operator_id": operator_id,
            "operator_name": operator_name,
            "title": st_spec["title"],
            "description": st_spec["description"],
            "event_type": st_spec["event_type"],
            "poster_url": st_spec["poster_url"],
            "images": [],
            "start_datetime": start.strftime("%Y-%m-%dT%H:%M"),
            "end_datetime":   end.strftime("%Y-%m-%dT%H:%M"),
            "doors_open_at": st_spec.get("doors_open_at"),
            "classes": _hydrate_classes(st_spec["classes"]),
            # PUBLISHED so the customer-facing search surfaces them.
            "status": "published",
            "featured": st_spec["days_out"] <= 21,
            "tags": st_spec.get("tags") or [],
            "age_restriction": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.event_showtimes.insert_one(showtime)
        inserted_showtimes += 1

    total_locs = await db.event_locations.count_documents({})
    total_showtimes = await db.event_showtimes.count_documents({"status": "published"})
    print(
        f"✓ Inserted {inserted_locs} locations, {inserted_showtimes} showtimes "
        f"(skipped {skipped} duplicates). DB now has {total_locs} locations "
        f"and {total_showtimes} published showtimes."
    )


if __name__ == "__main__":
    asyncio.run(main())
