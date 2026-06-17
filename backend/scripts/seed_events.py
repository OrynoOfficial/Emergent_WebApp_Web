"""
Seed a few realistic Events into the dev DB.

Why this exists separately from `seed_database.py`:
  - `seed_database.py` stores events with a legacy `date` field, but the public
    `/api/events/` endpoint filters by `start_date >= today`, so legacy seeds
    don't surface. This script writes events using the *current* model fields
    (`start_date`, `end_date`, `event_type`, `ticket_types`, etc.) so the
    EventBooking regression flow has data to chew on.

Run:  cd /app/backend && python -m scripts.seed_events
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from dotenv import load_dotenv

# Make the package importable when run via `python -m scripts.seed_events`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings


SEED_EVENTS = [
    {
        "name": "Afrobeat Festival 2026",
        "event_type": "festival",
        "venue_name": "Palais des Sports",
        "city": "Douala",
        "tags": ["music", "festival", "afrobeats"],
        "days_out": 21,
        "ticket_types": [
            {"name": "General Admission", "price": 15000, "quantity": 2000, "sold": 320},
            {"name": "VIP",                "price": 35000, "quantity":  300, "sold":  80},
            {"name": "VIP Box",            "price": 75000, "quantity":   50, "sold":  12},
        ],
    },
    {
        "name": "TechSummit Yaoundé",
        "event_type": "conference",
        "venue_name": "Hilton Yaoundé Conference Hall",
        "city": "Yaoundé",
        "tags": ["tech", "startup", "conference"],
        "days_out": 35,
        "ticket_types": [
            {"name": "Early Bird", "price": 25000, "quantity": 400, "sold": 96},
            {"name": "Standard",   "price": 40000, "quantity": 600, "sold": 50},
            {"name": "Investor",   "price":100000, "quantity":  80, "sold": 10},
        ],
    },
    {
        "name": "Bafoussam Comedy Night",
        "event_type": "party",
        "venue_name": "Centre Culturel Bafoussam",
        "city": "Bafoussam",
        "tags": ["comedy", "night"],
        "days_out": 14,
        "ticket_types": [
            {"name": "Floor",  "price":  8000, "quantity": 400, "sold": 60},
            {"name": "Balcony","price": 12000, "quantity": 200, "sold": 20},
        ],
    },
]


async def main():
    load_dotenv("/app/backend/.env")
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.effective_db_name]

    # Find an operator that already supports events. If none, pick the first
    # operator and tag it — events need an owning operator for permission scopes.
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

    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    for spec in SEED_EVENTS:
        # Skip if an event with this name already exists for this operator.
        existing = await db.events.find_one({
            "name": spec["name"],
            "operator_id": operator_id,
        })
        if existing:
            skipped += 1
            continue

        start = now + timedelta(days=spec["days_out"])
        end = start + timedelta(hours=4)
        capacity = sum(t["quantity"] for t in spec["ticket_types"])
        sold = sum(t.get("sold", 0) for t in spec["ticket_types"])

        event = {
            "_id": str(uuid4()),
            "name": spec["name"],
            "description": f"{spec['name']} live at {spec['venue_name']}.",
            "event_type": spec["event_type"],
            "operator_id": operator_id,
            "operator_name": operator_name,
            "venue_name": spec["venue_name"],
            "venue_address": f"{spec['venue_name']}, {spec['city']}",
            "city": spec["city"],
            # CRITICAL: route filters on `start_date >= today`, so use ISO date.
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date":   end.strftime("%Y-%m-%d"),
            "doors_open": "18:00",
            "images": [],
            "ticket_types": spec["ticket_types"],
            "total_capacity": capacity,
            "tickets_sold": sold,
            "status": "published",
            "is_active": True,
            "featured": spec["days_out"] <= 21,
            "tags": spec["tags"],
            "country": op.get("country") or op.get("base_country") or "Cameroon",
            "contact_email": op.get("contact_email"),
            "contact_phone": op.get("contact_phone"),
            "created_at": now,
            "updated_at": now,
        }
        await db.events.insert_one(event)
        inserted += 1

    total = await db.events.count_documents({})
    print(f"✓ Inserted {inserted} new events, skipped {skipped} duplicates. Total in DB: {total}.")


if __name__ == "__main__":
    asyncio.run(main())
