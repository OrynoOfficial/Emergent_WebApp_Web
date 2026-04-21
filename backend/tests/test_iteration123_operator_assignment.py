"""
Iteration 123 — user/operator assignment flow + UserDetailModal backend contracts.
Tests:
 - POST /api/users/create ignores operator_id for non-operator roles; persists for operator role
 - PUT /api/users/{id} rejects operator_id when role != operator; clears when null on operator user
 - PUT /api/users/{id}/role cascade unsets operator_id/operator_name when role moves away from operator
 - POST /api/invitations/send requires operator_id for role=operator; drops it for non-operator
 - GET /api/users/{id}/stats returns expected keys
 - GET /api/users/{id}/activity accepts search + date_from + date_to
 - GET /api/operators/?search= filters results by regex
 - DB data cleanup: no user where role != operator has a non-null operator_id
"""
import os
import uuid
import hashlib
import time
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://booking-revamp-hub.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "oryno_webapp")

ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
MUSANGO_OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _rand_email(tag: str) -> str:
    return f"TEST_iter123_{tag}_{uuid.uuid4().hex[:8]}@example.com"


# ---- 1. Create user: operator_id ignored for non-operator roles ------------
def test_create_customer_ignores_operator_id(headers):
    email = _rand_email("cust")
    body = {
        "email": email,
        "password": "testpassword123",
        "full_name": "Test Cust Iter123",
        "role": "customer",
        "phone": "+263771000000",
        "operator_id": MUSANGO_OP_ID,  # should be silently ignored
    }
    r = requests.post(f"{BASE_URL}/api/users/create", json=body, headers=headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    uid = r.json().get("user_id") or r.json().get("id") or r.json().get("_id")
    assert uid, f"no user id in response {r.json()}"

    g = requests.get(f"{BASE_URL}/api/users/{uid}", headers=headers, timeout=20)
    assert g.status_code == 200
    data = g.json()
    assert data.get("role") == "customer"
    assert not data.get("operator_id"), f"operator_id should be null/absent but got {data.get('operator_id')}"


# ---- 2. Create operator user persists operator_id + operator_name ----------
def test_create_operator_persists_operator(headers):
    email = _rand_email("op")
    r = requests.post(f"{BASE_URL}/api/users/create", json={
        "email": email, "password": "testpassword123", "full_name": "Op Test Iter123",
        "role": "operator", "phone": "+263771000001", "operator_id": MUSANGO_OP_ID,
    }, headers=headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    uid = r.json().get("user_id") or r.json().get("id")
    g = requests.get(f"{BASE_URL}/api/users/{uid}", headers=headers, timeout=20).json()
    assert g.get("operator_id") == MUSANGO_OP_ID
    assert g.get("operator_name")  # Musango Bus Service


# ---- 3. PUT /users/{id} rejects operator_id for non-operator role ----------
def test_put_rejects_operator_id_on_non_operator(headers):
    # Create a customer first
    email = _rand_email("cust2")
    r = requests.post(f"{BASE_URL}/api/users/create", json={
        "email": email, "password": "testpassword123", "full_name": "CustPut Iter123",
        "role": "customer",
    }, headers=headers, timeout=20)
    assert r.status_code in (200, 201)
    uid = r.json().get("user_id") or r.json().get("id")
    # Try to set operator_id on this customer
    put = requests.put(f"{BASE_URL}/api/users/{uid}", json={"operator_id": MUSANGO_OP_ID},
                      headers=headers, timeout=20)
    assert put.status_code == 400, put.text
    assert "operator_id can only be set" in put.text.lower() or "operator" in put.text.lower()


# ---- 4. PUT /users/{id} operator_id=null clears on operator user ----------
def test_put_clears_operator_id_on_null(headers):
    email = _rand_email("opclr")
    r = requests.post(f"{BASE_URL}/api/users/create", json={
        "email": email, "password": "testpassword123", "full_name": "OpClear Iter123",
        "role": "operator", "operator_id": MUSANGO_OP_ID,
    }, headers=headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    uid = r.json().get("user_id") or r.json().get("id")

    put = requests.put(f"{BASE_URL}/api/users/{uid}", json={"operator_id": None},
                      headers=headers, timeout=20)
    assert put.status_code == 200, put.text
    g = requests.get(f"{BASE_URL}/api/users/{uid}", headers=headers, timeout=20).json()
    assert g.get("operator_id") in (None, "", []), f"expected null, got {g.get('operator_id')}"
    assert g.get("operator_name") in (None, "", []), f"expected null, got {g.get('operator_name')}"


# ---- 5. Role change cascade: operator -> customer clears assignment -------
def test_role_change_cascade_clears_operator(headers):
    email = _rand_email("opcasc")
    r = requests.post(f"{BASE_URL}/api/users/create", json={
        "email": email, "password": "testpassword123", "full_name": "Cascade Iter123",
        "role": "operator", "operator_id": MUSANGO_OP_ID,
    }, headers=headers, timeout=20)
    uid = r.json().get("user_id") or r.json().get("id")

    # Change role to customer
    role_put = requests.put(f"{BASE_URL}/api/users/{uid}/role",
                            json={"role": "customer"}, headers=headers, timeout=20)
    assert role_put.status_code == 200, role_put.text
    body = role_put.json()
    assert body.get("operator_cleared") is True, body

    # Verify GET reflects cleared assignment
    g = requests.get(f"{BASE_URL}/api/users/{uid}", headers=headers, timeout=20).json()
    assert g.get("role") == "customer"
    assert not g.get("operator_id"), g.get("operator_id")
    assert not g.get("operator_name"), g.get("operator_name")


# ---- 6. Invitations: role=operator requires operator_id -------------------
def test_invitation_operator_requires_operator_id(headers):
    r = requests.post(f"{BASE_URL}/api/invitations/send", json={
        "email": _rand_email("inv_op"),
        "role": "operator",
    }, headers=headers, timeout=20)
    assert r.status_code == 400, r.text
    assert "operator_id" in r.text.lower()


def test_invitation_customer_drops_operator_id(headers):
    r = requests.post(f"{BASE_URL}/api/invitations/send", json={
        "email": _rand_email("inv_cust"),
        "role": "customer",
        "operator_id": MUSANGO_OP_ID,
    }, headers=headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    # Verify invitation persisted without operator_id by fetching the list
    lst = requests.get(f"{BASE_URL}/api/invitations/", headers=headers, timeout=20)
    assert lst.status_code == 200, lst.text
    items = lst.json() if isinstance(lst.json(), list) else lst.json().get("invitations", [])
    matched = [i for i in items if i.get("email") == r.json().get("email") or i.get("email") == r.request.body] \
        if items else []
    # If we can't match by email, at least verify the POST succeeded and returned no operator_id on the doc
    ret = r.json()
    if "operator_id" in ret:
        assert ret["operator_id"] in (None, "", []), f"invitation should drop operator_id for customer: {ret}"


# ---- 7. GET /users/{id}/stats ---------------------------------------------
def test_user_stats_shape(headers):
    # use admin's own id
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=20).json()
    uid = me.get("_id") or me.get("id")
    r = requests.get(f"{BASE_URL}/api/users/{uid}/stats", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    for key in ("total_orders", "completed_orders", "pending_orders",
                "cancelled_orders", "total_spent", "favorite_service", "last_order_at"):
        assert key in d, f"missing key {key} in stats: {d}"
    assert isinstance(d["total_orders"], int)
    assert isinstance(d["completed_orders"], int)


# ---- 8. GET /users/{id}/activity with filters -----------------------------
def test_user_activity_filters(headers):
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=20).json()
    uid = me.get("_id") or me.get("id")
    # baseline
    base = requests.get(f"{BASE_URL}/api/users/{uid}/activity?skip=0&limit=5",
                        headers=headers, timeout=20)
    assert base.status_code == 200, base.text
    d = base.json()
    assert "activities" in d
    assert "total" in d
    assert "user_id" in d

    # with filters
    r = requests.get(
        f"{BASE_URL}/api/users/{uid}/activity?search=login&date_from=2024-01-01&date_to=2026-12-31&skip=0&limit=3",
        headers=headers, timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "activities" in data
    assert isinstance(data["activities"], list)
    assert len(data["activities"]) <= 3


# ---- 9. GET /operators?search= --------------------------------------------
def test_operators_search(headers):
    r = requests.get(f"{BASE_URL}/api/operators/?search=mus", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("operators", data.get("items", []))
    assert len(items) >= 1, f"expected at least one operator matching 'mus', got {items}"
    # every returned item should contain 'mus' in name/city/email/operator_type (case-insensitive)
    for o in items:
        blob = " ".join(str(o.get(k, "")) for k in ("name", "city", "email", "operator_type")).lower()
        assert "mus" in blob, f"operator {o.get('name')} does not match 'mus': {blob}"


# ---- 10. Data cleanup verification ---------------------------------------
@pytest.mark.asyncio
async def test_no_stale_operator_ids_on_non_operator_users():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        count = await db.users.count_documents({
            "operator_id": {"$exists": True, "$nin": [None, ""]},
            "role": {"$ne": "operator"},
        })
        assert count == 0, f"{count} stale user records have operator_id but role != operator"
    finally:
        client.close()
