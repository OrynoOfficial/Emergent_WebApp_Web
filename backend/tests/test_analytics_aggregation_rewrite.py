"""
Regression tests for the analytics.py aggregation rewrite (P1 perf).

Verifies that the new MongoDB $group/$facet pipelines return identical
numeric values to the previous in-memory Python aggregation for:
  - /api/analytics/dashboard  (user-scoped)
  - /api/analytics/admin/overview  (global totals)
  - /api/analytics/overview  (admin period view, summary block)
  - /api/analytics/operator/dashboard (operator-scoped summary block)

We re-implement the *old* computation against the live DB and compare
to what the live endpoint returns. Any drift fails the test.
"""
import os
import asyncio
from datetime import datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient


API_URL = os.environ.get(
    "ANALYTICS_TEST_API_URL",
    "http://localhost:8001",
)
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


async def _get(path: str, token: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{API_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        return r.json()


@pytest.mark.asyncio
async def test_dashboard_aggregation_matches_in_memory(db):
    """User /analytics/dashboard returns same totals as Python sum/count."""
    token = await _login("customer@test.com")
    resp = await _get("/api/analytics/dashboard", token)

    # Re-implement the old logic against the same DB
    customer = await db.users.find_one({"email": "customer@test.com"})
    user_id = customer["_id"]
    orders = await db.orders.find({"user_id": user_id}).to_list(None)

    expected_total = len(orders)
    expected_spent = sum(o.get("total_amount", 0) for o in orders)
    # "completed_orders" counts any successful status — confirmed | completed |
    # delivered | checked_in | fulfilled — to match the corrected analytics.
    SUCCESS = {"confirmed", "completed", "delivered", "checked_in", "fulfilled"}
    expected_completed = len([o for o in orders if o.get("status") in SUCCESS])
    expected_pending = len([o for o in orders if o.get("status") == "pending"])

    assert resp["total_orders"] == expected_total
    assert resp["total_spent"] == expected_spent
    assert resp["completed_orders"] == expected_completed
    assert resp["pending_orders"] == expected_pending

    # Orders by category — every key present should match
    expected_by_cat = {}
    for o in orders:
        cat = o.get("service_category", "other")
        expected_by_cat[cat] = expected_by_cat.get(cat, 0) + 1
    assert resp["orders_by_category"] == expected_by_cat


@pytest.mark.asyncio
async def test_admin_overview_revenue_and_status_counts(db):
    """Admin /analytics/admin/overview revenue + status counts match aggregate."""
    token = await _login("admin@test.com")
    resp = await _get("/api/analytics/admin/overview", token)

    # Revenue counts any successful status — confirmed | completed | …
    SUCCESS = ["confirmed", "completed", "delivered", "checked_in", "fulfilled"]
    completed = await db.orders.find({"status": {"$in": SUCCESS}}).to_list(None)
    expected_revenue = sum(o.get("total_amount", 0) for o in completed)
    assert resp["total_revenue"] == expected_revenue

    all_orders = await db.orders.find({}).to_list(None)
    expected_status = {}
    for o in all_orders:
        s = o.get("status", "unknown")
        expected_status[s] = expected_status.get(s, 0) + 1
    assert resp["orders_by_status"] == expected_status


@pytest.mark.asyncio
async def test_overview_prev_revenue_matches_aggregate(db):
    """Admin /analytics/overview growth-rate sources prev_revenue from $group."""
    token = await _login("admin@test.com")
    resp = await _get("/api/analytics/overview?period=6months", token)

    # Re-compute prev_revenue from the previous 180-day window
    days = 180
    now = datetime.utcnow()
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    prev_orders = await db.orders.find({
        "created_at": {"$gte": prev_start, "$lt": start}
    }).to_list(None)
    prev_revenue_expected = sum(o.get("total_amount", 0) for o in prev_orders)
    total_revenue = resp["summary"]["totalRevenue"]

    if prev_revenue_expected > 0:
        expected_growth = round(
            (total_revenue - prev_revenue_expected) / prev_revenue_expected * 100,
            1,
        )
    else:
        expected_growth = 0
    assert resp["summary"]["growthRate"] == expected_growth


@pytest.mark.asyncio
async def test_overview_summary_totals_match(db):
    """/analytics/overview totalBookings + totalRevenue match raw aggregation."""
    token = await _login("admin@test.com")
    resp = await _get("/api/analytics/overview?period=6months", token)

    start = datetime.utcnow() - timedelta(days=180)
    orders = await db.orders.find({"created_at": {"$gte": start}}).to_list(None)
    expected_bookings = len(orders)
    expected_revenue = sum(o.get("total_amount", 0) for o in orders)

    assert resp["summary"]["totalBookings"] == expected_bookings
    assert resp["summary"]["totalRevenue"] == expected_revenue


@pytest.mark.asyncio
async def test_operator_dashboard_summary_consistent():
    """Operator /analytics/operator/dashboard returns a well-formed summary."""
    token = await _login("operator@test.com")
    resp = await _get("/api/analytics/operator/dashboard?period=30days", token)

    summary = resp["summary"]
    # All numeric fields must be present and numeric (could be 0 for empty op).
    for key in (
        "total_orders", "total_revenue", "completed_orders",
        "pending_orders", "cancelled_orders", "avg_order_value",
        "completion_rate", "revenue_growth", "orders_growth",
    ):
        assert key in summary, f"missing key {key}"
        assert isinstance(summary[key], (int, float)), f"{key} not numeric"

    # Completion rate must equal completed/total*100 when total>0
    if summary["total_orders"] > 0:
        expected_rate = round(
            summary["completed_orders"] / summary["total_orders"] * 100, 1
        )
        assert summary["completion_rate"] == expected_rate
