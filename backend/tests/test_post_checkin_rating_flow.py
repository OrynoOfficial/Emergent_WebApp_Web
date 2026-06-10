"""
Tests for the post-check-in customer rating flow.

Covers:
  - POST /api/ratings/  REJECTS when the user hasn't been checked in for the entity
  - POST /api/ratings/  ACCEPTS when a matching checked-in order exists
  - The created rating carries enriched metadata (operator_id, operator_name,
    order_id, order_number, service_type, entity_name)
  - GET  /api/ratings/pending returns the user's checked-in-but-not-yet-rated
    orders and EXCLUDES once a rating is filed
"""
import os
import uuid
from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient


API_URL = os.environ.get("ANALYTICS_TEST_API_URL", "http://localhost:8001")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "oryno_webapp")


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


async def _login(email: str, password: str = "testpassword123") -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{API_URL}/api/auth/login",
            json={"email": email, "password": password},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("access_token") or data.get("token") or ""


async def _customer_uid(db):
    return (await db.users.find_one({"email": "customer@test.com"}, {"_id": 1}))["_id"]


@pytest_asyncio.fixture
async def seed_checkin(db):
    """Seed a checked-in cinema order for the customer."""
    uid = await _customer_uid(db)
    order_id = f"test-rating-order-{uuid.uuid4()}"
    entity_id = f"test-cinema-{uuid.uuid4()}"
    operator_id = f"test-op-{uuid.uuid4()}"
    now = datetime.now(timezone.utc)
    await db.orders.insert_one({
        "_id": order_id,
        "order_number": f"CIN-RATE-{uuid.uuid4().hex[:6]}",
        "user_id": uid,
        "service_id": entity_id,
        "service_name": "Test Cinema Showtime",
        "service_type": "cinema",
        "operator_id": operator_id,
        "operator_name": "Test Cinema Operator",
        "status": "confirmed",
        "checked_in": True,
        "checked_in_at": now.isoformat(),
        "total_amount": 5000,
        "created_at": now,
    })
    yield {"order_id": order_id, "entity_id": entity_id, "operator_id": operator_id, "uid": uid}
    await db.orders.delete_one({"_id": order_id})
    await db.ratings.delete_many({"entity_id": entity_id})


@pytest.mark.asyncio
async def test_rating_rejects_when_not_checked_in(db):
    """A user without ANY checked-in order for the entity is blocked."""
    token = await _login("customer@test.com")
    fake_entity = f"never-used-{uuid.uuid4()}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{API_URL}/api/ratings/",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "entity_type": "cinema",
                "entity_id": fake_entity,
                "rating": 5,
                "review": "Should not work",
            },
        )
    assert r.status_code == 400
    assert "checked in" in r.text.lower()


@pytest.mark.asyncio
async def test_rating_accepted_after_check_in(db, seed_checkin):
    """When a matching checked-in order exists, rating is accepted."""
    s = seed_checkin
    token = await _login("customer@test.com")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{API_URL}/api/ratings/",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "entity_type": "cinema",
                "entity_id": s["entity_id"],
                "rating": 4,
                "review": "Loved the seats",
                "order_id": s["order_id"],
            },
        )
    assert r.status_code == 200, r.text
    # Verify enriched metadata persisted
    rating = await db.ratings.find_one({"entity_id": s["entity_id"]})
    assert rating is not None
    assert rating["operator_id"] == s["operator_id"]
    assert rating["operator_name"] == "Test Cinema Operator"
    assert rating["service_type"] == "cinema"
    assert rating["order_id"] == s["order_id"]
    assert rating["entity_name"] == "Test Cinema Showtime"


@pytest.mark.asyncio
async def test_pending_endpoint_lists_checked_in_unrated(db, seed_checkin):
    """The /pending endpoint surfaces this checked-in order until a rating lands."""
    s = seed_checkin
    token = await _login("customer@test.com")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{API_URL}/api/ratings/pending",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    pending_orders = {p["order_id"] for p in r.json().get("pending", [])}
    assert s["order_id"] in pending_orders


@pytest.mark.asyncio
async def test_pending_excludes_after_rating(db, seed_checkin):
    """After a rating is filed, the order disappears from /pending."""
    s = seed_checkin
    token = await _login("customer@test.com")
    async with httpx.AsyncClient(timeout=15.0) as client:
        post = await client.post(
            f"{API_URL}/api/ratings/",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "entity_type": "cinema",
                "entity_id": s["entity_id"],
                "rating": 5,
                "review": "Top tier",
                "order_id": s["order_id"],
            },
        )
        assert post.status_code == 200
        r = await client.get(
            f"{API_URL}/api/ratings/pending",
            headers={"Authorization": f"Bearer {token}"},
        )
    pending_orders = {p["order_id"] for p in r.json().get("pending", [])}
    assert s["order_id"] not in pending_orders
