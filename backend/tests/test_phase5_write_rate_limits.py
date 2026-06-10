"""
Phase-5 write-endpoint rate-limiting regression.

Verifies:
  1. /api/orders/create caps at 30/min/user (bot bursts get 429).
  2. /api/payments/initiate caps at 15/min/user.
  3. The key function is per-USER (not pure IP) — two different users
     sharing an IP each get their own budget.
  4. The 429 response surface includes a Retry-After header so polite
     clients back off automatically.

Requires `RATE_LIMIT_ENABLED=true` (the default). If the env var is set to
false the test suite skips — it's not testing the limiter's bypass.
"""
import asyncio
import os
import uuid

import httpx
import pytest

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")

ORDER_PAYLOAD = {
    "service_type": "package", "service_id": "rl-suite",
    "service_name": "RL test", "total_amount": 1, "currency": "XAF",
    "status": "pending", "payment_status": "unpaid", "booking_details": {},
}
PAYMENT_PAYLOAD = {
    "amount": 100, "payment_method": "mtn_momo",
    "customer_phone": "+237699123456", "order_id": "rl-pay-test",
}


async def _login(email: str, password: str = "testpassword123") -> str:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{API_URL}/api/auth/login",
                         json={"email": email, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]


def _is_disabled() -> bool:
    return os.environ.get("RATE_LIMIT_ENABLED", "true").lower() == "false"


@pytest.mark.asyncio
async def test_order_create_rate_limit_fires():
    """A burst above the 30/min cap should yield SOME 429s."""
    if _is_disabled():
        pytest.skip("RATE_LIMIT_ENABLED=false")
    token = await _login("customer@test.com")

    async def one_call(client):
        return await client.post(
            f"{API_URL}/api/orders/create",
            headers={"Authorization": f"Bearer {token}",
                     "Idempotency-Key": str(uuid.uuid4())},
            json=ORDER_PAYLOAD,
        )

    async with httpx.AsyncClient(timeout=30) as c:
        results = await asyncio.gather(*(one_call(c) for _ in range(45)))

    codes = [r.status_code for r in results]
    n_ok = sum(1 for c in codes if c == 200)
    n_blocked = sum(1 for c in codes if c == 429)
    assert n_blocked > 0, f"Expected some 429 in burst of 45, got: {codes}"
    # Cap is 30/min; allow a small slack window for concurrent flush.
    assert n_ok <= 35, f"Too many made it through ({n_ok})"


@pytest.mark.asyncio
async def test_payment_initiate_rate_limit_fires():
    """A burst above the 15/min cap should yield SOME 429s."""
    if _is_disabled():
        pytest.skip("RATE_LIMIT_ENABLED=false")
    token = await _login("customer@test.com")

    async def one_call(client):
        return await client.post(
            f"{API_URL}/api/payments/initiate",
            headers={"Authorization": f"Bearer {token}"},
            json=PAYMENT_PAYLOAD,
        )

    async with httpx.AsyncClient(timeout=30) as c:
        results = await asyncio.gather(*(one_call(c) for _ in range(25)))

    n_blocked = sum(1 for r in results if r.status_code == 429)
    n_ok = sum(1 for r in results if r.status_code == 200)
    assert n_blocked > 0, "Expected 429s"
    assert n_ok <= 18, f"Cap too loose, {n_ok} got through"


@pytest.mark.asyncio
async def test_different_users_have_separate_budgets():
    """User A hitting their limit should NOT block User B from creating orders."""
    if _is_disabled():
        pytest.skip("RATE_LIMIT_ENABLED=false")
    t_admin = await _login("admin@test.com")
    t_cust = await _login("customer@test.com")

    # Saturate customer's budget with 35 calls.
    async def one_call(client, tok):
        return await client.post(
            f"{API_URL}/api/orders/create",
            headers={"Authorization": f"Bearer {tok}",
                     "Idempotency-Key": str(uuid.uuid4())},
            json=ORDER_PAYLOAD,
        )

    async with httpx.AsyncClient(timeout=30) as c:
        # First saturate the customer
        cust_results = await asyncio.gather(*(one_call(c, t_cust) for _ in range(35)))
        # Then verify admin can still post (their bucket is untouched).
        admin_result = await one_call(c, t_admin)

    cust_429 = sum(1 for r in cust_results if r.status_code == 429)
    assert cust_429 > 0, "Customer's burst should have hit the cap"
    assert admin_result.status_code == 200, (
        f"Admin should NOT be affected by customer's bucket (got {admin_result.status_code}). "
        f"This means the key function is IP-based, not user-based."
    )


@pytest.mark.asyncio
async def test_429_includes_retry_after_header():
    """Polite clients rely on Retry-After to back off."""
    if _is_disabled():
        pytest.skip("RATE_LIMIT_ENABLED=false")
    token = await _login("customer@test.com")

    async with httpx.AsyncClient(timeout=30) as c:
        # Burst hard enough to guarantee at least one 429.
        results = await asyncio.gather(*(
            c.post(f"{API_URL}/api/orders/create",
                   headers={"Authorization": f"Bearer {token}",
                            "Idempotency-Key": str(uuid.uuid4())},
                   json=ORDER_PAYLOAD)
            for _ in range(50)
        ))

    blocked = [r for r in results if r.status_code == 429]
    assert blocked, "No 429 to inspect"
    assert "retry-after" in {k.lower() for k in blocked[0].headers.keys()}, \
        f"429 missing Retry-After header: {dict(blocked[0].headers)}"
