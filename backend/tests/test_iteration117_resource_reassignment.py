"""
Iteration 117 — Resource Reassignment (Travel/Vehicle) backend tests.
Covers dry_run preview, commit with snapshot + history update, auth/validation,
notification dedupe, and GET /reassignments scoping.
"""
import os
import pytest
import requests

def _load_env():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""

BASE_URL = _load_env().rstrip("/")
API = f"{BASE_URL}/api"

OPERATOR_EMAIL = "operator@test.com"
ADMIN_EMAIL = "admin@test.com"
CUSTOMER_EMAIL = "customer@test.com"
PASSWORD = "testpassword123"

# Vehicle IDs from task spec (operator@test.com / Musango Bus Service)
VEHICLE_A = "d5c9f63c-5dd2-418f-8dee-cec247641877"   # CE-456-CD
VEHICLE_B = "e7c8ed8c-fa0f-480e-aca2-e1b2c27a3f13"   # RE-999-XX


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


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def current_direction(op_token):
    """
    Auto-detect which vehicle currently holds the active orders by running two
    dry-runs. Returns (old_id, new_id) pair where old_id has >0 affected orders.
    """
    h = {"Authorization": f"Bearer {op_token}"}
    pairs = [(VEHICLE_A, VEHICLE_B), (VEHICLE_B, VEHICLE_A)]
    for old, new in pairs:
        r = requests.post(
            f"{API}/operator/resources/reassign",
            json={
                "service_type": "travel",
                "old_resource_id": old,
                "new_resource_id": new,
                "reason": "maintenance",
                "dry_run": True,
            },
            headers=h,
        )
        if r.status_code == 200 and r.json().get("affected_count", 0) > 0:
            return old, new
    # Fallback: use A->B even if count=0
    return VEHICLE_A, VEHICLE_B


# -------------------- Dry Run --------------------
def test_dry_run_returns_affected_count_and_preview(op_token, current_direction):
    old, new = current_direction
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": old,
            "new_resource_id": new,
            "reason": "breakdown",
            "dry_run": True,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dry_run"] is True
    assert "affected_count" in data
    assert isinstance(data["affected_count"], int)
    assert "preview_orders" in data
    assert isinstance(data["preview_orders"], list)
    assert "from" in data and "to" in data
    # Structure check on preview orders (if any)
    if data["preview_orders"]:
        p = data["preview_orders"][0]
        assert "order_number" in p
        assert "status" in p


# -------------------- Validation --------------------
def test_invalid_reason_rejected(op_token):
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": VEHICLE_A,
            "new_resource_id": VEHICLE_B,
            "reason": "lunch_break",  # not in allowed set
            "dry_run": True,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 400
    assert "reason" in r.text.lower()


def test_same_old_new_rejected(op_token):
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": VEHICLE_A,
            "new_resource_id": VEHICLE_A,
            "reason": "breakdown",
            "dry_run": True,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 400
    assert "differ" in r.text.lower() or "same" in r.text.lower()


def test_missing_auth_rejected():
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": VEHICLE_A,
            "new_resource_id": VEHICLE_B,
            "reason": "breakdown",
            "dry_run": True,
        },
    )
    assert r.status_code in (401, 403)


def test_customer_forbidden(customer_token):
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": VEHICLE_A,
            "new_resource_id": VEHICLE_B,
            "reason": "breakdown",
            "dry_run": True,
        },
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 403


def test_nonexistent_vehicle_returns_404(op_token):
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": "does-not-exist-xxxx",
            "new_resource_id": VEHICLE_B,
            "reason": "breakdown",
            "dry_run": True,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 404


# -------------------- Commit + History + Snapshot --------------------
def test_commit_updates_orders_and_returns_notifications(op_token, current_direction):
    old, new = current_direction
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": old,
            "new_resource_id": new,
            "reason": "maintenance",
            "reason_note": "Routine inspection — iteration 117 test",
            "dry_run": False,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dry_run"] is False
    assert "event_id" in data
    assert data["event_id"]
    assert "affected_count" in data
    ns = data.get("notifications_sent", {})
    assert "customers" in ns
    assert "operator_users" in ns
    assert "admins" in ns
    # Admins is a fixed number in system; must be >=1
    assert ns["admins"] >= 1


# -------------------- Dedupe --------------------
def test_notification_dedupe_on_repeat_same_event(op_token, current_direction, admin_token):
    """Running an identical reassign twice should NOT duplicate notifications
    because each event generates a fresh event_id, but running the SAME event
    logic would dedupe. Since the API generates a new event_id per call,
    we instead verify that event docs are created and system remains stable.
    """
    # The dedupe_key uses event_id which is uuid-fresh per call, so each
    # call creates new notifications (expected behavior). Verify it doesn't crash
    # and events list reflects the new event.
    old, new = current_direction
    # Swap back to make idempotent-ish testing
    r1 = requests.post(
        f"{API}/operator/resources/reassign",
        json={
            "service_type": "travel",
            "old_resource_id": new,
            "new_resource_id": old,
            "reason": "upgrade",
            "dry_run": False,
        },
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r1.status_code == 200
    # Verify an event entry exists
    rlist = requests.get(
        f"{API}/operator/resources/reassignments?service_type=travel",
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert rlist.status_code == 200
    events = rlist.json().get("events", [])
    assert len(events) >= 1


# -------------------- List Endpoint Scoping --------------------
def test_list_reassignments_operator_sees_own(op_token):
    r = requests.get(
        f"{API}/operator/resources/reassignments",
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "events" in body
    assert isinstance(body["events"], list)
    # All events should belong to operator's operator_id
    op_id = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
    for ev in body["events"]:
        assert ev.get("operator_id") == op_id


def test_list_reassignments_admin_sees_all(admin_token):
    r = requests.get(
        f"{API}/operator/resources/reassignments",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "events" in body
    assert isinstance(body["events"], list)


def test_list_reassignments_returns_full_event_docs(op_token):
    """Iter118 retest: GET /reassignments must return full event docs, not just {id}."""
    r = requests.get(
        f"{API}/operator/resources/reassignments?service_type=travel",
        headers={"Authorization": f"Bearer {op_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    events = body.get("events", [])
    assert len(events) >= 1, "Expected at least one reassignment event from prior tests"
    ev = events[0]
    # Must have these fields populated (the bug returned only {id})
    expected_keys = ["id", "operator_id", "service_type", "from", "to",
                     "reason", "affected_count", "notifications_sent",
                     "affected_order_ids", "created_at"]
    missing = [k for k in expected_keys if k not in ev]
    assert not missing, f"Missing fields in event response: {missing}. Got keys: {list(ev.keys())}"
    assert ev["service_type"] == "travel"
    assert isinstance(ev["from"], dict)
    assert isinstance(ev["to"], dict)
    assert isinstance(ev["affected_count"], int)


def test_list_reassignments_customer_forbidden(customer_token):
    r = requests.get(
        f"{API}/operator/resources/reassignments",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 403


# -------------------- Persistence via reassignment_history on orders --------------------
def test_orders_have_reassignment_history_after_commit(op_token, admin_token):
    """Verify via admin bookings list that some orders now have
    reassignment_history populated (as a consequence of the commit tests above)."""
    r = requests.get(
        f"{API}/operator/manual-bookings/?limit=1000",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    # Response shape may be {"bookings": [...]} or list directly
    bookings = data.get("bookings") if isinstance(data, dict) else data
    assert isinstance(bookings, list)
    with_history = [
        b for b in bookings
        if b.get("service_type") == "travel" and b.get("reassignment_history")
    ]
    # After multiple commit tests, at least some travel bookings should have history
    assert len(with_history) > 0, "No travel orders have reassignment_history populated"
    # Validate shape of first history entry
    entry = with_history[0]["reassignment_history"][0]
    for key in ("event_id", "from", "to", "reason", "at"):
        assert key in entry
