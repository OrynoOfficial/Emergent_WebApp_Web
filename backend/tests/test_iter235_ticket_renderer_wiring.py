"""
Iter 235 — Wire luggage descriptions into the e-ticket renderer + propagate
operator.logo_url onto orders so the customer-facing order detail / ticket
shows the brand instead of a generic monogram.
"""
import os
import uuid
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


def _login(email, password):
    return requests.post(f"{API}/api/auth/login", json={"email": email, "password": password}).json().get("access_token")


def _admin():
    """Use super-admin since cross-operator edits require super_admin role."""
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def test_operator_logo_url_persisted_on_orders():
    """When an operator has a logo_url, every new order they receive carries
    it in `order.operator_logo_url` so the customer's order-detail view can
    render the brand without an extra round-trip."""
    h = _admin()
    # Set a logo on the seeded operator
    test_logo = f"https://logo.test/iter235-{uuid.uuid4().hex[:6]}.png"
    r = requests.put(f"{API}/api/operators/{OP_ID}", json={"logo_url": test_logo}, headers=h)
    assert r.status_code == 200, r.text

    # Create a hotel for that operator (we need a service to attach the order to)
    r = requests.post(f"{API}/api/hotels/", json={
        "name": f"Pytest Logo Hotel {uuid.uuid4().hex[:6]}",
        "address": "Test", "city": "Douala", "country": "Cameroon",
        "star_rating": 3, "phone": "+237600000000", "email": "t@t.t",
        "amenities": [], "images": [], "operator_id": OP_ID,
    }, headers=h)
    assert r.status_code == 200, r.text
    hotel_id = r.json().get("hotel_id") or r.json().get("id")

    # Customer places an order via the e-commerce booking endpoint.
    cust = _customer()
    r = requests.post(f"{API}/api/orders/create", json={
        "service_type": "hotel",
        "service_id": hotel_id,
        "service_name": "Pytest Hotel",
        "total_amount": 50000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "check_in": "2026-12-30",
            "check_out": "2026-12-31",
            "guests": 2,
        },
    }, headers=cust)
    assert r.status_code == 200, r.text
    order_id = r.json().get("order_id") or r.json().get("id")

    # GET back — operator_logo_url must be present.
    r = requests.get(f"{API}/api/orders/{order_id}", headers=cust)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("operator_logo_url") == test_logo, f"Expected logo on order, got {body.get('operator_logo_url')}"


def test_extra_luggage_descriptions_persist_on_travel_order():
    """The customer's bag manifest survives a round-trip through the order
    create → fetch lifecycle so the e-ticket renderer can display it."""
    cust = _customer()
    # Pull a real travel route (orders.py validates service exists for travel).
    routes = requests.get(f"{API}/api/travel/routes", params={"limit": 1}).json().get("routes", [])
    assert routes, "Need at least one seeded travel route for this test"
    service_id = routes[0]["id"]

    bags = [
        "Two laptops, three pairs of jeans and a charger",
        "Wedding gift for my sister — sealed gift box",
    ]
    r = requests.post(f"{API}/api/orders/create", json={
        "service_type": "travel",
        "service_id": service_id,
        "service_name": "Yaoundé → Douala",
        "total_amount": 13000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "departure_city": "Yaoundé",
            "destination_city": "Douala",
            "extra_luggage": 2,
            "extra_luggage_descriptions": bags,
            "selected_seats": [3, 4],
        },
    }, headers=cust)
    assert r.status_code == 200, r.text
    order_id = r.json().get("order_id") or r.json().get("id")

    r = requests.get(f"{API}/api/orders/{order_id}", headers=cust)
    assert r.status_code == 200
    desc = (r.json().get("booking_details") or {}).get("extra_luggage_descriptions")
    assert desc == bags, f"Bag descriptions did not survive the round-trip; got {desc}"


def test_travel_routes_enriched_with_operator_logo():
    """Customer-facing /api/travel/routes lists each route with the parent
    operator's logo_url so the trip-details modal can show it."""
    h = _admin()
    test_logo = f"https://logo.test/routes-{uuid.uuid4().hex[:6]}.png"
    requests.put(f"{API}/api/operators/{OP_ID}", json={"logo_url": test_logo}, headers=h)

    r = requests.get(f"{API}/api/travel/routes", params={"limit": 50})
    assert r.status_code == 200, r.text
    routes = r.json().get("routes", [])
    matches = [rt for rt in routes if rt.get("operator_id") == OP_ID]
    if matches:
        assert any(rt.get("operator_logo_url") == test_logo for rt in matches), \
            f"None of the {len(matches)} routes for operator {OP_ID} carry the new logo_url"
