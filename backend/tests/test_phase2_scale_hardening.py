"""
Phase-2 scale-hardening regression suite.

Verifies:
  1. JWT→user cache: repeated /api/auth/me calls share the same logical
     payload (the cache layer doesn't corrupt fields).
  2. Idempotency on /api/orders/create: same key + user → same order, no
     duplicate inserted.
  3. Idempotency on /api/orders/create: same key + DIFFERENT user → no
     replay (the lock is namespaced by user).
  4. Analytics rollup: POST /admin/rollup/rebuild produces a rollup_docs
     count ≥ 0 with a sane elapsed_s.
  5. Rollup summary endpoint reads back consistent numbers.
"""
import asyncio
import os
import uuid

import httpx
import pytest

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")


async def _login(email: str, password: str = "testpassword123") -> str:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{API_URL}/api/auth/login",
                         json={"email": email, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]


@pytest.mark.asyncio
async def test_jwt_cache_returns_consistent_user():
    """Repeated /me reads should return the same email + role from the cache."""
    token = await _login("customer@test.com")
    async with httpx.AsyncClient(timeout=15) as c:
        first = None
        for _ in range(5):
            r = await c.get(f"{API_URL}/api/auth/me",
                            headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("email") == "customer@test.com"
            assert body.get("role") == "customer"
            if first is None:
                first = body
            else:
                # Cache must not drop or rewrite stable identifying fields.
                # /me returns email + role; both must stay consistent.
                assert body["email"] == first["email"]
                assert body["role"] == first["role"]


@pytest.mark.asyncio
async def test_idempotency_replays_same_order():
    """Two creates with the same Idempotency-Key return the same order_id."""
    token = await _login("customer@test.com")
    key = str(uuid.uuid4())
    payload = {
        "service_type": "package", "service_id": "test-svc",
        "service_name": "Idempotency test", "total_amount": 100,
        "currency": "XAF", "status": "pending", "payment_status": "unpaid",
        "booking_details": {},
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r1 = await c.post(f"{API_URL}/api/orders/create",
                          headers={"Authorization": f"Bearer {token}",
                                   "Idempotency-Key": key},
                          json=payload)
        r2 = await c.post(f"{API_URL}/api/orders/create",
                          headers={"Authorization": f"Bearer {token}",
                                   "Idempotency-Key": key},
                          json=payload)
        assert r1.status_code == 200, r1.text
        assert r2.status_code == 200, r2.text
        assert r1.json()["order_id"] == r2.json()["order_id"], \
            "Same Idempotency-Key must return the original order_id"


@pytest.mark.asyncio
async def test_idempotency_namespaced_per_user():
    """The same key submitted by TWO different users must NOT replay."""
    t1 = await _login("customer@test.com")
    t2 = await _login("admin@test.com")
    key = str(uuid.uuid4())
    payload = {
        "service_type": "package", "service_id": "test-svc",
        "service_name": "Namespace test", "total_amount": 50,
        "currency": "XAF", "status": "pending", "payment_status": "unpaid",
        "booking_details": {},
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r1 = await c.post(f"{API_URL}/api/orders/create",
                          headers={"Authorization": f"Bearer {t1}",
                                   "Idempotency-Key": key},
                          json=payload)
        r2 = await c.post(f"{API_URL}/api/orders/create",
                          headers={"Authorization": f"Bearer {t2}",
                                   "Idempotency-Key": key},
                          json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["order_id"] != r2.json()["order_id"], \
            "Different users sharing a key must create separate orders"


@pytest.mark.asyncio
async def test_rollup_rebuild_and_summary():
    """The rollup rebuild + summary round-trip returns coherent numbers."""
    token = await _login("superadmin@oryno.com")
    async with httpx.AsyncClient(timeout=30) as c:
        r1 = await c.post(f"{API_URL}/api/analytics/admin/rollup/rebuild?days_back=30",
                          headers={"Authorization": f"Bearer {token}"})
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert body["rebuilt_days"] == 30
        assert body["rollup_docs"] >= 0
        # Elapsed must be a sane sub-minute value (we just exercised it locally).
        assert 0 <= body["elapsed_s"] < 60, f"Elapsed bogus: {body['elapsed_s']}"

        r2 = await c.get(f"{API_URL}/api/analytics/admin/rollup/summary?days=30",
                         headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200, r2.text
        summary = r2.json()
        assert "orders" in summary and "revenue" in summary
        assert summary["days"] == 30
        # Orders/revenue are non-negative scalars.
        assert summary["orders"] >= 0
        assert summary["revenue"] >= 0


if __name__ == "__main__":
    asyncio.run(test_jwt_cache_returns_consistent_user())
    asyncio.run(test_idempotency_replays_same_order())
    asyncio.run(test_idempotency_namespaced_per_user())
    asyncio.run(test_rollup_rebuild_and_summary())
    print("Phase-2 smoke tests passed.")
