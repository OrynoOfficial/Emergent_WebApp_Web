"""
Iteration 126 — Travel ticket Service Date/Time correctness.
Regression: OrderDetailModal used to fall back to created_at for Service Date
when booking_details.travel_date was missing. Ensure backend preserves the
travel_date/service_time/travel_time aliases sent from TravelBooking.jsx.
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}
OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def travel_route():
    """Fetch any travel route from operator@test.com (Musango Bus Service).
    Fallback: public listing."""
    # Try public listing first
    r = requests.get(f"{BASE_URL}/api/travel/routes", timeout=15)
    if r.status_code == 200:
        data = r.json()
        routes = data if isinstance(data, list) else data.get("routes", [])
        for rt in routes:
            if rt.get("departure_time"):
                return rt
    # Operator login and fetch their routes
    ro = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR, timeout=15)
    if ro.status_code == 200:
        t = ro.json().get("token") or ro.json().get("access_token")
        r2 = requests.get(
            f"{BASE_URL}/api/travel/routes",
            headers={"Authorization": f"Bearer {t}"},
            timeout=15,
        )
        if r2.status_code == 200:
            routes = r2.json() if isinstance(r2.json(), list) else r2.json().get("routes", [])
            for rt in routes:
                if rt.get("departure_time"):
                    return rt
    return None


# ----------------------------------------------------------------------
# 1. Travel order creation preserves travel_date/service_time as sent.
# ----------------------------------------------------------------------
def test_travel_order_preserves_travel_date_and_service_time(customer_headers, travel_route):
    if not travel_route:
        pytest.skip("No travel route available to build a booking")
    # Use tomorrow in YYYY-MM-DD; route.departure_time is HH:mm
    trip_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    route_id = travel_route.get("_id") or travel_route.get("id")
    dep_time = travel_route.get("departure_time") or "08:00"
    arr_time = travel_route.get("arrival_time") or "14:00"
    from_city = travel_route.get("from_city") or "Douala"
    to_city = travel_route.get("to_city") or "Yaoundé"

    payload = {
        "service_type": "travel",
        "service_id": route_id,
        "service_name": f"Bus: {from_city} → {to_city}",
        "total_amount": 7500,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "departure_city": from_city,
            "destination_city": to_city,
            "departure_time": dep_time,
            "arrival_time": arr_time,
            "service_time": dep_time,
            "travel_time": dep_time,
            "travel_date": trip_date,
            "service_date": trip_date,
            "operator_id": travel_route.get("operator_id"),
            "operator_name": travel_route.get("operator_name", "Musango"),
            "vehicle_type": travel_route.get("vehicle_type", "bus"),
            "is_round_trip": False,
            "passengers": [
                {
                    "first_name": "TEST_Customer",
                    "last_name": "Iter126",
                    "id_number": "CM-TEST-126",
                    "phone": "+237 677251682",
                }
            ],
            "selected_seats": [],
        },
    }

    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=customer_headers, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
    body = r.json()
    order_id = body.get("order_id") or body.get("_id") or body.get("id")
    assert order_id, f"No order_id returned: {body}"

    # Fetch the order back
    g = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=customer_headers, timeout=15)
    assert g.status_code == 200, g.text
    order = g.json()

    bd = order.get("booking_details") or {}
    # Core assertions — travel_date === selected route date, service_time === departure_time
    assert bd.get("travel_date") == trip_date, f"travel_date mismatch: {bd.get('travel_date')} vs {trip_date}"
    assert bd.get("service_date") == trip_date, f"service_date mismatch: {bd.get('service_date')} vs {trip_date}"
    assert bd.get("departure_time") == dep_time, f"departure_time mismatch: {bd.get('departure_time')} vs {dep_time}"
    assert bd.get("service_time") == dep_time, f"service_time mismatch: {bd.get('service_time')} vs {dep_time}"
    assert bd.get("travel_time") == dep_time, f"travel_time mismatch: {bd.get('travel_time')} vs {dep_time}"

    # created_at must be different from travel_date (a timestamp, not the YYYY-MM-DD trip date)
    created_at = order.get("created_at")
    assert created_at, "Order missing created_at"
    # created_at is ISO datetime; travel_date is YYYY-MM-DD date only
    assert trip_date not in str(created_at)[:10] or str(created_at) != trip_date, \
        f"created_at {created_at} must be a full timestamp, not equal to travel_date {trip_date}"
    # They must not be identical strings
    assert str(created_at) != trip_date


# ----------------------------------------------------------------------
# 2. Legacy order (no travel_date in booking_details): Service Date must
#    NOT silently borrow created_at. Backend simply preserves the payload;
#    the UI-side regression is exercised in the Playwright script. Here we
#    only confirm the backend does not inject travel_date on its own.
# ----------------------------------------------------------------------
def test_legacy_travel_order_without_travel_date(customer_headers, travel_route):
    if not travel_route:
        pytest.skip("No travel route available")
    route_id = travel_route.get("_id") or travel_route.get("id")
    payload = {
        "service_type": "travel",
        "service_id": route_id,
        "service_name": "Bus legacy",
        "total_amount": 5000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "departure_city": travel_route.get("from_city", "Douala"),
            "destination_city": travel_route.get("to_city", "Yaoundé"),
            # Intentionally no travel_date/service_date/service_time/travel_time
            "passengers": [{"first_name": "TEST_Legacy", "last_name": "Iter126", "id_number": "L1"}],
        },
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=customer_headers, timeout=15)
    assert r.status_code in (200, 201), r.text
    oid = r.json().get("order_id") or r.json().get("_id") or r.json().get("id")
    g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer_headers, timeout=15)
    assert g.status_code == 200
    bd = g.json().get("booking_details") or {}
    # Backend must NOT invent a travel_date equal to created_at
    assert bd.get("travel_date") in (None, ""), f"Legacy order must not have travel_date, got {bd.get('travel_date')}"
    assert bd.get("service_date") in (None, ""), f"Legacy order must not have service_date, got {bd.get('service_date')}"
