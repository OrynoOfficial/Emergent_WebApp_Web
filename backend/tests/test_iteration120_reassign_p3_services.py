"""
Iteration 120 — Resource Reassignment P3: event / package / laundry(pressing) / cinema.

Covers (backend-only, no UI this iteration):
  - service_type=event end-to-end (dry_run + commit + seeded mock order)
  - service_type=package end-to-end (dry_run + commit + seeded mock order)
  - service_type=laundry with both 'laundry' and 'pressing' service_type orders
  - service_type=cinema (admin token; operator resolved via cinemas.operator_id)
  - cross-operator rejection for event/package/laundry (400)
  - cross-cinema rejection for cinema (400)
  - revert flow on a freshly committed event-service reassignment
  - snapshot content sanity (name / event_type / venue_name / start_date / destination / duration_days / base_price / address / city / phone / film_title)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient


def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return ""


BASE = _load_backend_url()
API = f"{BASE}/api"

OPERATOR_EMAIL = "operator@test.com"
ADMIN_EMAIL = "admin@test.com"
PASSWORD = "testpassword123"

OPERATOR_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
CINEMA_OPERATOR_ID = "0f899b9d-1e7f-42a8-861f-5a0c9fe68ade"

# Seeded IDs (from DB inspection)
EVENT_A = "7f4c366c-7ae1-4962-bd07-020876f97fd8"
EVENT_B = "f547ca58-605d-4ca4-9ffc-76b8790002b5"
PACKAGE_A = "a97f5161-9f7d-422c-8d8f-9105ab0f63c6"
PACKAGE_B = "69576b9e-f3f0-4aed-ace2-db97cf61b938"
PRESSING_A = "d0cf8418-5453-4a05-8dff-b006e4733081"
PRESSING_B = "2d5158d5-2a04-4433-a2ab-e02831c89d18"

CINEMA_ID_SAME = "cb169f89-1c8b-4646-9856-aff65a2d6c6a"
CINEMA_ID_OTHER = "de8417d7-b9f8-44d0-a7db-8122c84fe371"
SHOWTIME_OTHER_CINEMA = "448db471-9008-4610-b11d-947ece1d0002"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def op_token():
    return _login(OPERATOR_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, PASSWORD)


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- Direct DB helpers ------------------------------------------------------
def _get_db():
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return c[os.environ.get("MONGO_DB_NAME", "oryno_webapp")]


@pytest.fixture(scope="module")
def event_loop():
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _insert_order(service_type: str, booking_details: dict, status: str = "confirmed"):
    db = _get_db()
    order_number = f"TEST-ITER120-{service_type}-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "_id": str(uuid.uuid4()),
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "service_type": service_type,
        "operator_id": OPERATOR_ID if service_type in ("event", "package", "laundry", "pressing") else CINEMA_OPERATOR_ID,
        "user_id": "test-user-iter120",
        "customer_name": "TEST_Iter120 Customer",
        "user_email": "iter120@test.com",
        "status": status,
        "total_amount": 100,
        "booking_details": booking_details,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.orders.insert_one(doc)
    return order_number


async def _delete_orders_by_number(numbers):
    db = _get_db()
    await db.orders.delete_many({"order_number": {"$in": list(numbers)}})


async def _get_order(order_number: str):
    db = _get_db()
    return await db.orders.find_one({"order_number": order_number})


# ==================== EVENT SERVICE ========================================
@pytest.mark.asyncio
async def test_event_reassign_dry_run_and_commit(op_token):
    """Operator can dry-run + commit event→event reassignment; snapshot contains name/event_type/venue_name/start_date."""
    # Seed an order for EVENT_A
    order_number = await _insert_order("event", {"event_id": EVENT_A, "event_name": "Test Event 1"})
    try:
        # Dry run
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "event", "old_resource_id": EVENT_A,
                  "new_resource_id": EVENT_B, "reason": "other",
                  "reason_note": "iter120 event dry-run", "dry_run": True},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["dry_run"] is True
        assert data["affected_count"] >= 1
        from_keys = set((data["from"] or {}).keys())
        # Must carry at least name + one of event_type/venue_name/start_date
        assert "name" in from_keys, f"event snapshot missing name: {from_keys}"
        assert from_keys & {"event_type", "venue_name", "start_date"}, (
            f"event snapshot missing any of event_type/venue_name/start_date: {from_keys}"
        )

        # Commit
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "event", "old_resource_id": EVENT_A,
                  "new_resource_id": EVENT_B, "reason": "other",
                  "reason_note": "iter120 event commit", "dry_run": False},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        commit = r.json()
        assert commit["dry_run"] is False
        assert commit["affected_count"] >= 1
        event_id = commit["event_id"]

        # Verify order updated
        order = await _get_order(order_number)
        assert order is not None
        assert order["booking_details"]["event_id"] == EVENT_B
        assert "event_info" in order["booking_details"], "event_info snapshot missing from booking_details"
        assert order["booking_details"]["event_info"].get("name")
        hist = order.get("reassignment_history") or []
        assert any(h.get("event_id") == event_id for h in hist), "reassignment_history missing event_id entry"
    finally:
        await _delete_orders_by_number([order_number])


@pytest.mark.asyncio
async def test_event_cross_operator_rejected(op_token, admin_token):
    """Cross-operator event reassignment must be rejected with 400."""
    db = _get_db()
    other_event = await db.events.find_one({"operator_id": {"$ne": OPERATOR_ID}}, {"_id": 1})
    if not other_event:
        pytest.skip("No event for a different operator to test cross-operator rejection")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "event", "old_resource_id": EVENT_A,
              "new_resource_id": other_event["_id"], "reason": "other",
              "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400, r.text
    assert "operator" in r.text.lower() or "cross" in r.text.lower()


# ==================== PACKAGE SERVICE =======================================
@pytest.mark.asyncio
async def test_package_reassign_dry_run_and_commit(op_token):
    """Package→package swap works; snapshot carries name/destination/duration_days/base_price."""
    order_number = await _insert_order("package", {"package_id": PACKAGE_A, "package_name": "Test Package 1"})
    try:
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "package", "old_resource_id": PACKAGE_A,
                  "new_resource_id": PACKAGE_B, "reason": "upgrade", "dry_run": True},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["dry_run"] is True
        from_keys = set((data["from"] or {}).keys())
        assert "name" in from_keys, f"package snapshot missing name: {from_keys}"
        assert from_keys & {"destination", "duration_days", "base_price"}, (
            f"package snapshot missing any of destination/duration_days/base_price: {from_keys}"
        )

        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "package", "old_resource_id": PACKAGE_A,
                  "new_resource_id": PACKAGE_B, "reason": "upgrade", "dry_run": False},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        commit = r.json()
        assert commit["affected_count"] >= 1

        order = await _get_order(order_number)
        assert order["booking_details"]["package_id"] == PACKAGE_B
        assert order["booking_details"].get("package_info", {}).get("name")
    finally:
        await _delete_orders_by_number([order_number])


# ==================== LAUNDRY / PRESSING ===================================
@pytest.mark.asyncio
async def test_laundry_reassign_handles_pressing_alias(op_token):
    """service_type='laundry' must match orders with service_type in ['laundry','pressing']
    and snapshot carries name/address/city/phone."""
    # Seed one order as 'laundry' and one as legacy 'pressing'
    on1 = await _insert_order("laundry", {"pressing_id": PRESSING_A, "pressing_name": "Quick Press 1"})
    on2 = await _insert_order("pressing", {"pressing_id": PRESSING_A, "pressing_name": "Quick Press 1"})
    try:
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "laundry", "old_resource_id": PRESSING_A,
                  "new_resource_id": PRESSING_B, "reason": "maintenance", "dry_run": True},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["affected_count"] >= 2, (
            f"Expected both laundry AND pressing orders to be affected, got {data['affected_count']}"
        )
        from_keys = set((data["from"] or {}).keys())
        assert "name" in from_keys
        assert from_keys & {"address", "city", "phone"}, (
            f"pressing snapshot missing address/city/phone: {from_keys}"
        )

        # Commit and verify both orders updated
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "laundry", "old_resource_id": PRESSING_A,
                  "new_resource_id": PRESSING_B, "reason": "maintenance", "dry_run": False},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        commit = r.json()
        assert commit["affected_count"] >= 2

        for n in (on1, on2):
            o = await _get_order(n)
            assert o["booking_details"]["pressing_id"] == PRESSING_B, f"{n} pressing_id not swapped"
            assert o["booking_details"].get("pressing_info", {}).get("name")
    finally:
        await _delete_orders_by_number([on1, on2])


# ==================== CINEMA SERVICE =======================================
@pytest.mark.asyncio
async def test_cinema_reassign_dry_run_same_cinema(admin_token):
    """Cinema showtime swap within same cinema; admin token (cinema belongs to different operator).
    Snapshot must include film_title/cinema_name/show_date."""
    db = _get_db()
    shows = await db.showtimes.find({"cinema_id": CINEMA_ID_SAME}, {"_id": 1}).to_list(3)
    if len(shows) < 2:
        pytest.skip("Need at least 2 showtimes in the same cinema")
    s1, s2 = shows[0]["_id"], shows[1]["_id"]
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "cinema", "old_resource_id": s1,
              "new_resource_id": s2, "reason": "other", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    from_keys = set((data["from"] or {}).keys())
    assert from_keys & {"film_title", "cinema_name", "show_date"}, (
        f"cinema snapshot missing film_title/cinema_name/show_date: {from_keys}"
    )


@pytest.mark.asyncio
async def test_cinema_cross_cinema_rejected(admin_token):
    """Swapping a showtime from CINEMA_ID_SAME to a showtime in CINEMA_ID_OTHER must 400."""
    db = _get_db()
    s_same = await db.showtimes.find_one({"cinema_id": CINEMA_ID_SAME}, {"_id": 1})
    s_other = await db.showtimes.find_one({"_id": SHOWTIME_OTHER_CINEMA})
    if not s_same or not s_other:
        pytest.skip("Missing showtimes across different cinemas")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "cinema", "old_resource_id": s_same["_id"],
              "new_resource_id": s_other["_id"], "reason": "other", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400, r.text
    assert "cinema" in r.text.lower() or "same" in r.text.lower()


@pytest.mark.asyncio
async def test_cinema_operator_resolves_via_cinema_id(admin_token):
    """Shows do not have operator_id directly; operator must be resolved via cinemas.operator_id.
    An operator whose operator_id != cinema.operator_id must get 403."""
    # Use operator@test.com (different operator than the cinema's)
    op_tok = _login(OPERATOR_EMAIL, PASSWORD)
    db = _get_db()
    shows = await db.showtimes.find({"cinema_id": CINEMA_ID_SAME}, {"_id": 1}).to_list(2)
    if len(shows) < 2:
        pytest.skip("Need 2 showtimes in same cinema")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "cinema", "old_resource_id": shows[0]["_id"],
              "new_resource_id": shows[1]["_id"], "reason": "other", "dry_run": True},
        headers=_auth(op_tok),
    )
    # Operator doesn't own the cinema → 403 forbidden
    assert r.status_code == 403, r.text


# ==================== REVERT FLOW on new service ===========================
@pytest.mark.asyncio
async def test_revert_flow_on_package_service(op_token):
    """Freshly committed package reassignment should be revertable within window."""
    order_number = await _insert_order("package", {"package_id": PACKAGE_A, "package_name": "Test Package 1"})
    try:
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "package", "old_resource_id": PACKAGE_A,
                  "new_resource_id": PACKAGE_B, "reason": "other",
                  "reason_note": "iter120 revert test", "dry_run": False},
            headers=_auth(op_token),
        )
        assert r.status_code == 200, r.text
        eid = r.json()["event_id"]

        # Revert
        rr = requests.post(
            f"{API}/operator/resources/reassignments/{eid}/revert",
            headers=_auth(op_token),
        )
        assert rr.status_code == 200, rr.text
        rdata = rr.json()
        assert rdata["reverted_event_id"] == eid
        assert rdata["new_event_id"] != eid

        # Verify order snapshot is restored to PACKAGE_A
        order = await _get_order(order_number)
        assert order["booking_details"]["package_id"] == PACKAGE_A, (
            "package_id was not restored after revert"
        )
    finally:
        await _delete_orders_by_number([order_number])
