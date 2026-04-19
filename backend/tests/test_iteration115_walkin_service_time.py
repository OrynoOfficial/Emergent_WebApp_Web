"""
Iteration 115 tests — Walk-in enhancements:
  - New `service_time` field on POST /api/operator/manual-bookings/ persisted on order.service_time
  - Travel walk-in with NO seats must succeed (seats optional)
  - service_time auto-populates booking_details.travel_time from the route's departure_time
  - User-provided service_time wins over the route's default
  - Seat conflict still returns 409 when seats are explicitly provided and overlap
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}
ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in login response: {data}"
    return token, data.get("user", {})


@pytest.fixture(scope="session")
def operator_headers():
    tok, user = _login(OPERATOR)
    return {"Authorization": f"Bearer {tok}"}, user


@pytest.fixture(scope="session")
def operator_travel_route(operator_headers):
    headers, user = operator_headers
    op_id = user.get("operator_id") or (user.get("operator_context") or {}).get("operator_id")
    assert op_id, f"operator user has no operator_id: {user}"
    r = requests.get(f"{BASE}/api/travel/routes", headers=headers, timeout=30)
    assert r.status_code == 200, r.text[:200]
    payload = r.json()
    routes = payload if isinstance(payload, list) else payload.get("routes") or payload.get("items") or []
    match = next((rt for rt in routes if rt.get("operator_id") == op_id), None) or (routes[0] if routes else None)
    assert match, "no travel routes available"
    return match


def _find_order(op_headers, order_number):
    """List on_site travel bookings and return the matching order dict."""
    r = requests.get(
        f"{BASE}/api/operator/manual-bookings/?channel=on_site&service_type=travel&limit=200",
        headers=op_headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    for b in r.json().get("bookings", []):
        if b.get("order_number") == order_number:
            return b
    return None


class TestWalkinServiceTime:
    """New iteration 115 behavior."""

    def test_travel_walkin_without_seats_succeeds(self, operator_headers, operator_travel_route):
        headers, _ = operator_headers
        route = operator_travel_route
        route_id = route.get("_id") or route.get("id")
        payload = {
            "service_type": "travel",
            "service_id": route_id,
            "service_name": route.get("route_name") or "iter115-noseats",
            "total_amount": 4500,
            "currency": "XAF",
            "payment_method": "cash",
            "customer": {"name": "Walk-in NoSeat", "phone": "+237600115001"},
            # Seats intentionally omitted — must still succeed
            "booking_details": {"passengers": 3, "passenger_name": "Group of 3"},
            "service_date": "2030-08-10",
            "service_time": "08:45",
            "notes": "TEST_iter115_noseats",
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"walk-in no-seats -> {r.status_code} {r.text[:300]}"
        j = r.json()
        assert j.get("success") is True
        assert j.get("order_id")
        order_number = j.get("order_number", "")
        assert order_number.startswith("TRV-")

        # Retrieve and validate booking_details
        order = _find_order(headers, order_number)
        assert order is not None, "created order not found in list"
        bd = order.get("booking_details", {})
        assert bd.get("seats_assigned") is False, f"seats_assigned must be False, got {bd.get('seats_assigned')}"
        assert bd.get("seat_numbers") == [], f"seat_numbers must be empty list, got {bd.get('seat_numbers')}"
        # passengers preserved from input
        assert int(bd.get("passengers", 0)) == 3, f"passengers={bd.get('passengers')}"
        # service_time stored on order
        assert order.get("service_time") == "08:45", f"order.service_time={order.get('service_time')}"
        # user-provided service_time must win for travel_time
        assert bd.get("travel_time") == "08:45", f"travel_time={bd.get('travel_time')}"

    def test_travel_walkin_service_time_autofills_from_route(self, operator_headers, operator_travel_route):
        headers, _ = operator_headers
        route = operator_travel_route
        route_id = route.get("_id") or route.get("id")
        route_departure = route.get("departure_time")
        if not route_departure:
            pytest.skip("route has no departure_time to auto-fill from")

        payload = {
            "service_type": "travel",
            "service_id": route_id,
            "service_name": route.get("route_name") or "iter115-autotime",
            "total_amount": 5000,
            "currency": "XAF",
            "payment_method": "cash",
            "customer": {"name": "Walk-in AutoTime", "phone": "+237600115002"},
            "booking_details": {"passengers": 1},
            "service_date": "2030-08-11",
            # service_time OMITTED — must auto-fill from route.departure_time
            "notes": "TEST_iter115_autotime",
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        order = _find_order(headers, r.json()["order_number"])
        assert order is not None
        bd = order.get("booking_details", {})
        # travel_time should fall back to route.departure_time
        assert bd.get("travel_time") == route_departure, (
            f"expected auto-fill {route_departure}, got {bd.get('travel_time')}"
        )
        # order.service_time was not provided -> stays None
        assert order.get("service_time") in (None, ""), f"service_time expected None, got {order.get('service_time')}"

    def test_travel_walkin_with_seats_and_explicit_service_time(self, operator_headers, operator_travel_route):
        headers, _ = operator_headers
        route = operator_travel_route
        route_id = route.get("_id") or route.get("id")
        seat = f"I{uuid.uuid4().hex[:4].upper()}"
        payload = {
            "service_type": "travel",
            "service_id": route_id,
            "service_name": route.get("route_name") or "iter115-seat",
            "total_amount": 5000,
            "currency": "XAF",
            "payment_method": "pos",
            "customer": {"name": "Walk-in WithSeat", "email": "customer@test.com"},
            "booking_details": {
                "seat_numbers": [seat],
                "travel_date": "2030-08-12",
                "passengers": 1,
            },
            "service_date": "2030-08-12",
            "service_time": "14:30",
            "notes": "TEST_iter115_seat",
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        j = r.json()
        order = _find_order(headers, j["order_number"])
        assert order is not None
        bd = order.get("booking_details", {})
        assert bd.get("seats_assigned") is True
        assert bd.get("seat_numbers") == [seat]
        assert order.get("service_time") == "14:30"
        assert bd.get("travel_time") == "14:30"

        # Duplicate seat booking must still 409
        r2 = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r2.status_code == 409, f"expected 409, got {r2.status_code} {r2.text[:200]}"

    def test_non_travel_walkin_persists_service_time(self, operator_headers):
        """service_time should persist on non-travel orders too (e.g., hotel/restaurant)."""
        headers, user = operator_headers
        op_id = user.get("operator_id") or (user.get("operator_context") or {}).get("operator_id")
        # find a service owned by this operator — try restaurants first, fall back to hotels
        svc = None
        svc_type = None
        for candidate_type, path in (("restaurant", "/api/restaurants"), ("hotel", "/api/hotels")):
            rr = requests.get(f"{BASE}{path}", headers=headers, timeout=30)
            if rr.status_code != 200:
                continue
            items = rr.json()
            items = items if isinstance(items, list) else items.get("items") or items.get(path.split("/")[-1]) or []
            match = next((s for s in items if s.get("operator_id") == op_id), None)
            if match:
                svc = match
                svc_type = candidate_type
                break
        if not svc:
            pytest.skip("no owned restaurant/hotel for operator")

        payload = {
            "service_type": svc_type,
            "service_id": svc.get("_id") or svc.get("id"),
            "total_amount": 12000,
            "currency": "XAF",
            "payment_method": "cash",
            "customer": {"name": "Walk-in NonTravel"},
            "booking_details": {"guests": 2},
            "service_date": "2030-09-01",
            "service_time": "19:00",
            "notes": "TEST_iter115_nontravel",
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        # List and verify order.service_time persisted
        lst = requests.get(
            f"{BASE}/api/operator/manual-bookings/?channel=on_site&service_type={svc_type}&limit=50",
            headers=headers, timeout=30,
        )
        assert lst.status_code == 200
        order = next((b for b in lst.json().get("bookings", []) if b.get("order_number") == r.json()["order_number"]), None)
        assert order is not None, "created non-travel order not found"
        assert order.get("service_time") == "19:00", f"service_time={order.get('service_time')}"
