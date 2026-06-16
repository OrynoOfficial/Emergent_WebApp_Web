"""
Iter 237 — Event Location + Showtime + Boarding Instructions.

Tests the full happy path:
  * Create EventLocation with each layout flavour (simple / visual_grid / zones)
  * Create Showtime with multiple ticket classes
  * Booking decrements `available_units` atomically
  * Overbook returns 409
  * Boarding instructions propagate from operator → order
"""
import os
import uuid
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


def _login(email, password):
    return requests.post(f"{API}/api/auth/login", json={"email": email, "password": password}).json().get("access_token")


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def _make_location(layout="simple", **extra):
    payload = {
        "name": f"Pytest Venue {uuid.uuid4().hex[:6]}",
        "city": "Douala",
        "address": "123 Test Boulevard",
        "latitude": 4.0511,
        "longitude": 9.7679,
        "layout_type": layout,
        "capacity": 200,
        "policies": ["No outside drinks", "Photo ID required"],
        "operator_id": OP_ID,
        **extra,
    }
    r = requests.post(f"{API}/api/event-locations/", json=payload, headers=_super())
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_location_crud_all_layout_types():
    # Simple
    sid = _make_location(layout="simple", simple_kind="theater_rows")
    # Visual grid
    gid = _make_location(layout="visual_grid", grid_rows=10, grid_cols=12, grid_aisle_after=6)
    # Zones
    zid = _make_location(layout="zones", zones=[
        {"id": "front", "name": "Front Row", "capacity": 50},
        {"id": "vip",   "name": "VIP Tables", "capacity": 30},
        {"id": "gen",   "name": "General",    "capacity": 200},
    ])
    # Listing scoped by operator
    r = requests.get(f"{API}/api/event-locations/?operator_id=" + OP_ID, headers=_super())
    assert r.status_code == 200
    ids = {l["id"] for l in r.json()["locations"]}
    assert {sid, gid, zid}.issubset(ids)


def test_showtime_book_decrements_atomically_and_overbook_409():
    loc_id = _make_location()
    # Create a showtime with 2 classes (VIP 10 seats / Standard 5 seats)
    r = requests.post(f"{API}/api/event-showtimes/", json={
        "location_id": loc_id,
        "title": f"Pytest Concert {uuid.uuid4().hex[:6]}",
        "start_datetime": "2026-12-31T20:00:00",
        "end_datetime": "2026-12-31T23:00:00",
        "classes": [
            {"name": "VIP",      "price": 50000, "total_units": 10, "color": "#9333ea"},
            {"name": "Standard", "price": 15000, "total_units": 5,  "color": "#3b82f6"},
        ],
    }, headers=_super())
    assert r.status_code == 200, r.text
    showtime_id = r.json()["id"]

    # Pull showtime back & grab class IDs
    body = requests.get(f"{API}/api/event-showtimes/{showtime_id}").json()
    vip = next(c for c in body["classes"] if c["name"] == "VIP")
    std = next(c for c in body["classes"] if c["name"] == "Standard")
    assert vip["available_units"] == 10 and std["available_units"] == 5

    # Customer books 3 VIPs
    cust = _customer()
    r = requests.post(f"{API}/api/event-showtimes/book", json={
        "showtime_id": showtime_id, "class_id": vip["id"], "quantity": 3,
    }, headers=cust)
    assert r.status_code == 200, r.text
    assert r.json()["total_amount"] == 150000  # 3 × 50000

    # Stock dropped
    body = requests.get(f"{API}/api/event-showtimes/{showtime_id}").json()
    assert next(c for c in body["classes"] if c["name"] == "VIP")["available_units"] == 7

    # Overbook attempt — 8 more VIPs (only 7 left)
    r = requests.post(f"{API}/api/event-showtimes/book", json={
        "showtime_id": showtime_id, "class_id": vip["id"], "quantity": 8,
    }, headers=cust)
    assert r.status_code == 409
    assert "left" in r.json()["detail"].lower()

    # Buying the remaining 7 VIP + all 5 Std → showtime auto-flips to sold_out
    r = requests.post(f"{API}/api/event-showtimes/book", json={
        "showtime_id": showtime_id, "class_id": vip["id"], "quantity": 7,
    }, headers=cust)
    assert r.status_code == 200
    r = requests.post(f"{API}/api/event-showtimes/book", json={
        "showtime_id": showtime_id, "class_id": std["id"], "quantity": 5,
    }, headers=cust)
    assert r.status_code == 200
    body = requests.get(f"{API}/api/event-showtimes/{showtime_id}").json()
    assert body["status"] == "sold_out"


def test_boarding_instructions_propagate_to_orders():
    """Operator's boarding_instructions snippet rides every new order."""
    h = _super()
    instr = "Please arrive 30 minutes early. Photo ID required at entry."
    requests.put(f"{API}/api/operators/{OP_ID}", json={"boarding_instructions": instr}, headers=h)

    # Quick path: create a location + showtime + book one ticket → check order
    loc_id = _make_location()
    r = requests.post(f"{API}/api/event-showtimes/", json={
        "location_id": loc_id,
        "title": "Pytest BI Show",
        "start_datetime": "2026-12-31T20:00:00",
        "end_datetime": "2026-12-31T22:00:00",
        "classes": [{"name": "GA", "price": 5000, "total_units": 5}],
    }, headers=h)
    showtime_id = r.json()["id"]
    cls = requests.get(f"{API}/api/event-showtimes/{showtime_id}").json()["classes"][0]

    cust = _customer()
    book = requests.post(f"{API}/api/event-showtimes/book", json={
        "showtime_id": showtime_id, "class_id": cls["id"], "quantity": 1,
    }, headers=cust)
    order_id = book.json()["order_id"]

    # Fetch order — boarding_instructions backfilled even though the booking
    # path didn't set it explicitly (GET enriches from operator on the fly).
    order = requests.get(f"{API}/api/orders/{order_id}", headers=cust).json()
    assert order.get("operator_boarding_instructions") == instr
