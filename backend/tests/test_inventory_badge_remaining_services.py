"""
Tests for Almost-Sold-Out badge inventory enrichment on the remaining
4 service backends: Car Rentals, Banquets, Pressings, Package Services.

Spec
----
- Car Rentals → emit `units_available` per (operator_id, vehicle_type)
  bucket = total available rows in bucket minus number of those rows
  on an active order.
- Banquets → emit `slots_available` = max(0, 30 - taken_days_in_next_30).
- Pressings → emit `slots_available` only when shop has
  `max_orders_per_day` (or legacy `pickup_slots_per_day`) > 0.
  Otherwise field is omitted (graceful skip).
- Package Services → emit `slots_available` only when service has
  `max_packages_per_day` / `daily_capacity` > 0. Otherwise omitted.
"""
import os
import uuid
import asyncio
from datetime import datetime, timedelta

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


async def _get(path: str, token: str = "") -> dict:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{API_URL}{path}", headers=headers)
        r.raise_for_status()
        return r.json()


async def _login(email: str, password: str = "testpassword123") -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{API_URL}/api/auth/login",
            json={"email": email, "password": password},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("access_token") or data.get("token") or ""


# ─── Car Rentals ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_car_rentals_units_available_reflects_active_bookings(db):
    """For every car returned, `units_available` matches bucket-aware count."""
    resp = await _get("/api/car-rental/?limit=20")
    cars = resp["cars"]
    assert cars, "expected at least one car in the dataset"

    # Build expected bucket counts
    for c in cars:
        op_id, vt = c.get("operator_id"), c.get("vehicle_type")
        if not (op_id and vt):
            continue
        total = await db.car_rentals.count_documents({
            "operator_id": op_id, "vehicle_type": vt, "is_available": True
        })
        # Booked cars in this bucket
        booked_ids = await db.orders.distinct("service_id", {
            "service_category": "car_rental",
            "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
        })
        booked_in_bucket = await db.car_rentals.count_documents({
            "_id": {"$in": booked_ids},
            "operator_id": op_id, "vehicle_type": vt,
        })
        expected = max(0, total - booked_in_bucket)
        assert c["units_available"] == expected, (
            f"car {c.get('make')} {c.get('model')}: "
            f"got units_available={c['units_available']}, expected={expected}"
        )


@pytest.mark.asyncio
async def test_car_rentals_units_available_drops_after_new_order(db):
    """Creating an active car-rental order should decrement the bucket count."""
    resp_before = await _get("/api/car-rental/?limit=20")
    sample = next(
        (c for c in resp_before["cars"]
         if c.get("operator_id") and c.get("vehicle_type")
         and c.get("units_available", 0) > 0),
        None,
    )
    if not sample:
        pytest.skip("no available-bucket car to test")

    # Find a non-booked car in that bucket to "book"
    op_id, vt = sample["operator_id"], sample["vehicle_type"]
    booked_ids = await db.orders.distinct("service_id", {
        "service_category": "car_rental",
        "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
    })
    free_car = await db.car_rentals.find_one({
        "operator_id": op_id, "vehicle_type": vt,
        "is_available": True, "_id": {"$nin": booked_ids},
    })
    if not free_car:
        pytest.skip("no free car in bucket to book")

    test_order_id = f"test-units-avail-{uuid.uuid4()}"
    await db.orders.insert_one({
        "_id": test_order_id,
        "service_category": "car_rental",
        "service_id": free_car["_id"],
        "status": "confirmed",
        "total_amount": 50000,
        "created_at": datetime.utcnow(),
    })
    try:
        resp_after = await _get("/api/car-rental/?limit=20")
        after = next(
            (c for c in resp_after["cars"]
             if c.get("operator_id") == op_id and c.get("vehicle_type") == vt),
            None,
        )
        assert after is not None
        assert after["units_available"] == sample["units_available"] - 1, (
            f"bucket count should drop by 1: before={sample['units_available']}, "
            f"after={after['units_available']}"
        )
    finally:
        await db.orders.delete_one({"_id": test_order_id})


# ─── Banquets ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_banquets_slots_available_reflects_30day_window(db):
    """Banquets emit slots_available = 30 - taken_days_in_window."""
    resp = await _get("/api/banquets/?limit=10")
    banquets = resp["banquets"]
    if not banquets:
        # No seed data; ensure endpoint at least 200s
        return
    for b in banquets:
        # When no bookings exist, slots_available should be 30
        active = await db.orders.count_documents({
            "service_category": "banquet",
            "service_id": b["id"],
            "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
        })
        if active == 0:
            assert b["slots_available"] == 30
        else:
            assert 0 <= b["slots_available"] <= 30


# ─── Pressings (graceful skip) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_pressings_omits_slots_when_capacity_unconfigured():
    """Shops without max_orders_per_day must NOT carry slots_available."""
    resp = await _get("/api/pressing/?limit=10")
    for p in resp["pressings"]:
        cap = p.get("max_orders_per_day") or p.get("pickup_slots_per_day")
        if not cap:
            assert "slots_available" not in p, (
                f"shop '{p.get('name')}' has no capacity field but emits "
                f"slots_available={p.get('slots_available')}"
            )


@pytest.mark.asyncio
async def test_pressings_emits_slots_when_capacity_configured(db):
    """Setting max_orders_per_day=20 on a shop should expose slots_available."""
    # Find any pressing shop and inject capacity for the test
    shop = await db.pressings.find_one({})
    if not shop:
        pytest.skip("no pressing shop seeded")
    sid = shop["_id"]
    await db.pressings.update_one({"_id": sid}, {"$set": {"max_orders_per_day": 20}})
    try:
        resp = await _get("/api/pressing/?limit=10")
        target = next((p for p in resp["pressings"] if p["id"] == sid), None)
        assert target is not None, "configured shop missing from listing"
        # Count today's active orders for this shop
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active = await db.orders.count_documents({
            "service_category": {"$in": ["pressing", "laundry"]},
            "service_id": sid,
            "created_at": {"$gte": today, "$lt": today + timedelta(days=1)},
            "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
        })
        assert target["slots_available"] == max(0, 20 - active)
    finally:
        await db.pressings.update_one({"_id": sid}, {"$unset": {"max_orders_per_day": ""}})


# ─── Package Services (graceful skip) ───────────────────────────────────


@pytest.mark.asyncio
async def test_package_services_omits_slots_when_capacity_unconfigured():
    """Services without max_packages_per_day must NOT carry slots_available."""
    resp = await _get("/api/package-services/search?limit=10")
    for s in resp["services"]:
        cap = s.get("max_packages_per_day") or s.get("daily_capacity")
        if not cap:
            assert "slots_available" not in s, (
                f"service '{s.get('name')}' has no capacity but emits "
                f"slots_available={s.get('slots_available')}"
            )


@pytest.mark.asyncio
async def test_package_services_emits_slots_when_capacity_configured(db):
    """Setting max_packages_per_day=50 should expose slots_available."""
    svc = await db.package_services.find_one({"status": "active"})
    if not svc:
        pytest.skip("no active package service seeded")
    sid = svc["_id"]
    await db.package_services.update_one(
        {"_id": sid}, {"$set": {"max_packages_per_day": 50}}
    )
    try:
        resp = await _get("/api/package-services/search?limit=20")
        target = next(
            (s for s in resp["services"]
             if (s.get("id") or s.get("_id")) == sid),
            None,
        )
        assert target is not None, "configured service missing from search"
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active = await db.packages.count_documents({
            "package_service_id": sid,
            "created_at": {"$gte": today, "$lt": today + timedelta(days=1)},
            "status": {"$nin": ["cancelled", "abandoned", "failed", "refunded"]},
        })
        assert target["slots_available"] == max(0, 50 - active)
    finally:
        await db.package_services.update_one(
            {"_id": sid}, {"$unset": {"max_packages_per_day": ""}}
        )
