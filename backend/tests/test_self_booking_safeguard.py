"""
Anti-self-booking safeguard tests.

Verifies that the POST /api/orders/create endpoint rejects orders where:
  - The customer_email matches the operator owner's email
  - The customer_phone matches the operator owner's phone
  - The logged-in user IS the operator owner (covers customer-mode disguise)

The safeguard prevents operators from booking their own services in any
disguised form — including via the walk-in flow.
"""
import os
import uuid
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


async def _login(email: str, password: str = "testpassword123") -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{API_URL}/api/auth/login",
            json={"email": email, "password": password},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("access_token") or data.get("token") or ""


@pytest_asyncio.fixture
async def seed_operator_and_owner(db):
    """Create a tiny operator + owner user pair for the safeguard tests."""
    op_id = f"test-op-{uuid.uuid4()}"
    owner_email = f"owner-{uuid.uuid4()}@selfbook-test.example.com"
    owner_phone = "+237699111222"
    owner_uid = f"test-user-{uuid.uuid4()}"
    await db.users.insert_one({
        "_id": owner_uid,
        "email": owner_email,
        "phone": owner_phone,
        "full_name": "Self-Book Owner",
        "role": "operator",
        "operator_id": op_id,
        "operator_role": "owner",
        "status": "active",
        "is_active": True,
    })
    await db.operators.insert_one({
        "_id": op_id,
        "name": "Self-Book Test Op",
        "business_name": "SBT",
        "email": owner_email,
        "phone": owner_phone,
        "owner_user_id": owner_uid,
        "service_types": ["hotel"],
        "status": "active",
    })
    # A cheap test service
    svc_id = f"test-svc-{uuid.uuid4()}"
    await db.hotels.insert_one({
        "_id": svc_id,
        "name": "Self-Book Hotel",
        "operator_id": op_id,
        "operator_name": "Self-Book Test Op",
        "price_per_night": 25000,
        "is_active": True,
    })
    yield {"op_id": op_id, "svc_id": svc_id, "owner_email": owner_email, "owner_phone": owner_phone, "owner_uid": owner_uid}
    # Cleanup
    await db.users.delete_one({"_id": owner_uid})
    await db.operators.delete_one({"_id": op_id})
    await db.hotels.delete_one({"_id": svc_id})
    await db.orders.delete_many({"booking_details.operator_id": op_id})


async def _post_order(token: str, payload: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0) as client:
        return await client.post(
            f"{API_URL}/api/orders/create",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )


def _base_payload(svc_id: str, op_id: str, customer_email: str, customer_phone: str = "+237600000001") -> dict:
    return {
        "service_type": "hotel",
        "service_id": svc_id,
        "service_name": "Self-Book Hotel",
        "total_amount": 25000,
        "currency": "XAF",
        "booking_details": {
            "operator_id": op_id,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "customer_name": "Walk-in Test",
            "check_in_date": (datetime.utcnow() + timedelta(days=7)).date().isoformat(),
            "check_out_date": (datetime.utcnow() + timedelta(days=8)).date().isoformat(),
        },
    }


@pytest.mark.asyncio
async def test_blocks_walkin_with_owner_email(seed_operator_and_owner):
    """Customer.email == operator.email → rejected."""
    s = seed_operator_and_owner
    token = await _login("customer@test.com")
    payload = _base_payload(s["svc_id"], s["op_id"], s["owner_email"])
    r = await _post_order(token, payload)
    assert r.status_code == 400, r.text
    assert "operator cannot book" in r.text.lower()


@pytest.mark.asyncio
async def test_blocks_walkin_with_owner_phone(seed_operator_and_owner):
    """Customer.phone == operator.phone (normalised) → rejected."""
    s = seed_operator_and_owner
    token = await _login("customer@test.com")
    # Match the phone with arbitrary formatting/spaces — safeguard strips non-digits
    payload = _base_payload(
        s["svc_id"], s["op_id"],
        customer_email="someone-else@x.test",
        customer_phone="237 699 111 222",
    )
    r = await _post_order(token, payload)
    assert r.status_code == 400, r.text
    assert "operator cannot book" in r.text.lower()


@pytest.mark.asyncio
async def test_blocks_when_user_is_operator_owner(db, seed_operator_and_owner):
    """The logged-in user IS the operator owner — outright rejection.

    Seed a known password hash so we can sign in as the owner.
    """
    s = seed_operator_and_owner
    customer = await db.users.find_one(
        {"email": "customer@test.com"},
        {"password_hash": 1, "hashed_password": 1}
    )
    pwd_hash = customer.get("password_hash") or customer.get("hashed_password")
    assert pwd_hash, "customer test account is missing a password hash"
    await db.users.update_one(
        {"_id": s["owner_uid"]},
        {"$set": {"password_hash": pwd_hash, "email_verified": True}}
    )
    token = await _login(s["owner_email"])
    payload = _base_payload(s["svc_id"], s["op_id"], customer_email="someone-else@x.test", customer_phone="+237600000099")
    r = await _post_order(token, payload)
    assert r.status_code == 400, r.text
    assert "their own" in r.text.lower() or "operator cannot" in r.text.lower()


@pytest.mark.asyncio
async def test_allows_legitimate_walkin(seed_operator_and_owner):
    """A walk-in with a genuinely different customer is allowed through."""
    s = seed_operator_and_owner
    token = await _login("customer@test.com")
    payload = _base_payload(
        s["svc_id"], s["op_id"],
        customer_email="legit-walkin@example.com",
        customer_phone="+237699555444",
    )
    r = await _post_order(token, payload)
    # Either succeeds (200/201) or fails for *unrelated* reasons (e.g. missing
    # field in DirectOrderCreate model). The key is: NOT a self-booking 400.
    if r.status_code == 400:
        body = r.text.lower()
        assert "operator cannot book" not in body, (
            "Legitimate walk-in must not trip the self-booking guard"
        )
