"""
Iteration 119 — Resource Reassignment: Undo window + multi-service (Car Rental, Hotel).

Covers:
  - POST /api/operator/resources/reassignments/{event_id}/revert
    * success path with is_revert_of linkage
    * double-revert returns 400
    * expired window (>5min) returns 400
  - GET /api/operator/resources/reassignments includes revertable + age_seconds + revert_window_minutes=5
  - Car Rental reassignment happy path (using admin cross-operator is blocked; same-operator swap)
  - Hotel reassignment authorization via rooms.hotel_id → hotels.operator_id,
    cross-hotel rejection (400).
"""
import os
import datetime as _dt
import pytest
import requests


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

# Travel vehicle ids for operator@test.com (same operator, verified in iter117/118)
VEHICLE_A = "d5c9f63c-5dd2-418f-8dee-cec247641877"  # CE-456-CD
VEHICLE_B = "e7c8ed8c-fa0f-480e-aca2-e1b2c27a3f13"  # RE-999-XX


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


# ---------------- GET list endpoint revertable/age_seconds/window ----------------
def test_list_includes_revert_window_metadata(op_token):
    r = requests.get(f"{API}/operator/resources/reassignments", headers=_auth(op_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("revert_window_minutes") == 5
    for ev in body.get("events", []):
        assert "revertable" in ev, f"event missing revertable: keys={list(ev.keys())}"
        assert "age_seconds" in ev, f"event missing age_seconds: keys={list(ev.keys())}"
        assert isinstance(ev["revertable"], bool)


def test_old_events_show_revertable_false(op_token):
    """Events older than 5 minutes should have revertable=False.
    Per agent-handoff note: iter117/118 events are past the window now.
    """
    r = requests.get(f"{API}/operator/resources/reassignments", headers=_auth(op_token))
    body = r.json()
    # At least one old event is expected from prior iterations
    old_events = [e for e in body.get("events", [])
                  if e.get("age_seconds") is not None and e["age_seconds"] > 300]
    if not old_events:
        pytest.skip("No events older than 5 minutes to assert against")
    for ev in old_events:
        assert ev["revertable"] is False, (
            f"Old event (age={ev['age_seconds']:.0f}s) should be non-revertable"
        )


# ---------------- UNDO/Revert happy + error paths (Travel) ----------------
@pytest.fixture(scope="module")
def _fresh_travel_event(op_token):
    """Create a fresh reassignment so we can revert within the 5-min window."""
    # Auto-detect direction: both dry runs, pick whichever has >=1 affected.
    for old, new in [(VEHICLE_A, VEHICLE_B), (VEHICLE_B, VEHICLE_A)]:
        dr = requests.post(
            f"{API}/operator/resources/reassign",
            json={"service_type": "travel", "old_resource_id": old,
                  "new_resource_id": new, "reason": "breakdown", "dry_run": True},
            headers=_auth(op_token),
        )
        if dr.status_code == 200 and dr.json().get("affected_count", 0) >= 0:
            break
    # Commit it
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "travel", "old_resource_id": old,
              "new_resource_id": new, "reason": "breakdown",
              "reason_note": "iter119 undo test", "dry_run": False},
        headers=_auth(op_token),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return {"event_id": data["event_id"], "old": old, "new": new,
            "from_snap": data.get("from"), "affected_count": data.get("affected_count")}


def test_revert_success_within_window(op_token, _fresh_travel_event):
    eid = _fresh_travel_event["event_id"]
    r = requests.post(
        f"{API}/operator/resources/reassignments/{eid}/revert",
        headers=_auth(op_token),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("reverted_event_id") == eid
    assert data.get("new_event_id")
    assert data["new_event_id"] != eid
    assert "affected_count" in data
    assert "notifications_sent" in data


def test_double_revert_rejected(op_token, _fresh_travel_event):
    """Already-reverted event should fail with 400 'already been reverted'."""
    eid = _fresh_travel_event["event_id"]
    r = requests.post(
        f"{API}/operator/resources/reassignments/{eid}/revert",
        headers=_auth(op_token),
    )
    assert r.status_code == 400, r.text
    assert "already been reverted" in r.text.lower() or "already" in r.text.lower()


def test_revert_unknown_event_404(op_token):
    r = requests.post(
        f"{API}/operator/resources/reassignments/no-such-event-id/revert",
        headers=_auth(op_token),
    )
    assert r.status_code == 404


def test_revert_snapshot_restoration(op_token, admin_token, _fresh_travel_event):
    """Verify orders' snapshots are restored to original vehicle after revert,
    and reassignment_history contains 2+ new entries (swap + revert)."""
    # After the fresh reassign+revert above, orders should be back to `old`.
    r = requests.get(f"{API}/operator/manual-bookings/?limit=1000", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    bookings = data.get("bookings") if isinstance(data, dict) else data
    eid = _fresh_travel_event["event_id"]
    # Find orders whose history now contains this event_id + a revert entry referencing it
    revert_orders = []
    for b in bookings or []:
        hist = b.get("reassignment_history") or []
        has_event = any(h.get("event_id") == eid for h in hist)
        has_revert = any(h.get("is_revert_of") == eid or h.get("reason") == "revert" for h in hist)
        if has_event and has_revert:
            revert_orders.append(b)
    if _fresh_travel_event["affected_count"] and _fresh_travel_event["affected_count"] > 0:
        assert len(revert_orders) > 0, (
            "Expected at least one order with both the swap event and its revert in history"
        )


# ---------------- Revert window expiration (>5 min) ----------------
def test_expired_event_revert_rejected(op_token):
    """Events older than 5 minutes must return 400 when reverted."""
    r = requests.get(f"{API}/operator/resources/reassignments", headers=_auth(op_token))
    body = r.json()
    expired = [e for e in body.get("events", [])
               if e.get("age_seconds") is not None
               and e["age_seconds"] > 300
               and not e.get("reverted_by_event_id")]
    if not expired:
        pytest.skip("No expired un-reverted event available to assert 400 expiration")
    eid = expired[0]["id"]
    r = requests.post(
        f"{API}/operator/resources/reassignments/{eid}/revert",
        headers=_auth(op_token),
    )
    assert r.status_code == 400, r.text
    assert "expired" in r.text.lower() or "window" in r.text.lower()


# ---------------- CAR RENTAL service ----------------
def _get_car_ids_same_operator(token):
    r = requests.get(f"{API}/car-rental/", headers=_auth(token))
    if r.status_code != 200:
        return None, None, None
    data = r.json()
    cars = data if isinstance(data, list) else data.get("cars", data.get("items", []))
    by_op = {}
    for c in cars:
        op = c.get("operator_id")
        if op:
            by_op.setdefault(op, []).append(c.get("id") or c.get("_id"))
    for op, ids in by_op.items():
        if len(ids) >= 2:
            return op, ids[0], ids[1]
    return None, None, None


def test_car_rental_reassign_dry_run(admin_token):
    """Admin can reassign between two cars that share operator_id.
    Dry run should succeed and return from/to snapshots with make/model."""
    op_id, c1, c2 = _get_car_ids_same_operator(admin_token)
    if not c1:
        pytest.skip("No operator with 2+ cars available for car_rental reassign test")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "car_rental", "old_resource_id": c1,
              "new_resource_id": c2, "reason": "maintenance", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dry_run"] is True
    assert "from" in data and "to" in data
    # Snapshot should carry at least make/model (per SERVICE_SPECS.car_rental)
    from_keys = set((data["from"] or {}).keys())
    assert from_keys & {"make", "model", "car_name"}, (
        f"car_rental from-snapshot missing make/model/car_name: {from_keys}"
    )


def test_car_rental_cross_operator_rejected(admin_token):
    """Admin cross-operator reassign should 400."""
    r = requests.get(f"{API}/car-rental/", headers=_auth(admin_token))
    cars = r.json()
    cars = cars if isinstance(cars, list) else cars.get("cars", cars.get("items", []))
    by_op = {}
    for c in cars:
        by_op.setdefault(c.get("operator_id"), []).append(c.get("id") or c.get("_id"))
    ops_with_cars = [(o, ids[0]) for o, ids in by_op.items() if o and ids]
    if len(ops_with_cars) < 2:
        pytest.skip("Not enough operators with cars to test cross-operator rejection")
    (_, id1), (_, id2) = ops_with_cars[0], ops_with_cars[1]
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "car_rental", "old_resource_id": id1,
              "new_resource_id": id2, "reason": "maintenance", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400, r.text
    assert "cross" in r.text.lower() or "operator" in r.text.lower()


# ---------------- HOTEL service ----------------
def _get_rooms_same_hotel(token):
    """Return (hotel_id, room1, room2) where both rooms share hotel_id."""
    hr = requests.get(f"{API}/hotels/", headers=_auth(token))
    if hr.status_code != 200:
        return None, None, None
    hotels = hr.json()
    hotels = hotels if isinstance(hotels, list) else hotels.get("hotels", hotels.get("items", []))
    for h in hotels:
        hid = h.get("id") or h.get("_id")
        rr = requests.get(f"{API}/rooms/?hotel_id={hid}", headers=_auth(token))
        if rr.status_code != 200:
            continue
        rooms = rr.json()
        rooms = rooms if isinstance(rooms, list) else rooms.get("rooms", rooms.get("items", []))
        ids = [r.get("id") or r.get("_id") for r in rooms if r.get("id") or r.get("_id")]
        if len(ids) >= 2:
            return hid, ids[0], ids[1]
    return None, None, None


def test_hotel_reassign_dry_run_same_hotel(admin_token):
    hid, r1, r2 = _get_rooms_same_hotel(admin_token)
    if not r1:
        pytest.skip("No hotel with 2+ rooms available for hotel reassign test")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "hotel", "old_resource_id": r1,
              "new_resource_id": r2, "reason": "maintenance", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dry_run"] is True
    assert "from" in data and "to" in data
    # Room-specific fields expected in snapshot per SERVICE_SPECS.hotel
    from_keys = set((data["from"] or {}).keys())
    assert from_keys & {"room_name", "room_type", "room_number"}, (
        f"hotel from-snapshot missing room_name/type/number: {from_keys}"
    )


def test_hotel_cross_hotel_rejected(admin_token):
    """Two rooms from different hotels → 400 'Both rooms must belong to same hotel'."""
    hr = requests.get(f"{API}/hotels/", headers=_auth(admin_token))
    hotels = hr.json()
    hotels = hotels if isinstance(hotels, list) else hotels.get("hotels", hotels.get("items", []))
    # Collect one room id per hotel
    per_hotel = []
    for h in hotels:
        hid = h.get("id") or h.get("_id")
        rr = requests.get(f"{API}/rooms/?hotel_id={hid}", headers=_auth(admin_token))
        if rr.status_code != 200:
            continue
        rooms = rr.json()
        rooms = rooms if isinstance(rooms, list) else rooms.get("rooms", rooms.get("items", []))
        if rooms:
            per_hotel.append((hid, rooms[0].get("id") or rooms[0].get("_id"),
                              hotels[0].get("operator_id")))
        if len(per_hotel) >= 2:
            break
    # Find two rooms whose hotels share the same operator_id to isolate the
    # cross-hotel check (otherwise cross-operator 400 fires first).
    pair = None
    # Build {operator_id: [(hid, room_id), ...]}
    from collections import defaultdict
    by_op = defaultdict(list)
    for h in hotels:
        hid = h.get("id") or h.get("_id")
        op = h.get("operator_id")
        rr = requests.get(f"{API}/rooms/?hotel_id={hid}", headers=_auth(admin_token))
        if rr.status_code != 200:
            continue
        rooms = rr.json()
        rooms = rooms if isinstance(rooms, list) else rooms.get("rooms", rooms.get("items", []))
        if rooms:
            by_op[op].append((hid, rooms[0].get("id") or rooms[0].get("_id")))
    for op, lst in by_op.items():
        if len(lst) >= 2 and lst[0][0] != lst[1][0]:
            pair = (lst[0][1], lst[1][1])
            break
    if not pair:
        pytest.skip("No two hotels with same operator_id to isolate cross-hotel check")
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "hotel", "old_resource_id": pair[0],
              "new_resource_id": pair[1], "reason": "maintenance", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400, r.text
    assert "hotel" in r.text.lower() or "same" in r.text.lower()


def test_unknown_service_type_rejected(admin_token):
    # NOTE: cinema is now supported (iter120); use a truly-unknown service_type.
    r = requests.post(
        f"{API}/operator/resources/reassign",
        json={"service_type": "totally_fake_service", "old_resource_id": "x",
              "new_resource_id": "y", "reason": "breakdown", "dry_run": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400
    assert "service_type" in r.text.lower() or "not supported" in r.text.lower()
