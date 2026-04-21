"""
Iteration 127 — Order read-time enrichment + naive-UTC parsing.
Validates that GET /api/orders/ and GET /api/orders/{id} backfill missing
booking_details from the originating travel route.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


@pytest.fixture(scope="module")
def customer_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def travel_route():
    r = requests.get(f"{BASE_URL}/api/travel/routes", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    routes = data if isinstance(data, list) else data.get("routes", [])
    for rt in routes:
        if rt.get("departure_time") and rt.get("from_city") and rt.get("to_city"):
            return rt
    pytest.skip("No suitable travel route found")


# ---------------------------------------------------------------
# 1. Enrichment backfills empty booking_details from route
# ---------------------------------------------------------------
def test_enrichment_backfills_legacy_travel_order(customer_headers, travel_route):
    route_id = travel_route.get("id") or travel_route.get("_id")
    payload = {
        "service_type": "travel",
        "service_id": route_id,
        "service_name": f"Legacy Bus: {travel_route['from_city']} → {travel_route['to_city']}",
        "total_amount": 5000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        # Empty-ish booking_details — force enrichment
        "booking_details": {
            "passengers": [{"first_name": "TEST_Enrich", "last_name": "Iter127", "id_number": "E127"}],
        },
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=customer_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    oid = r.json().get("order_id")
    assert oid

    # GET /api/orders/{id}
    g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer_headers, timeout=20)
    assert g.status_code == 200, g.text
    order = g.json()

    # id normalization: no raw _id, has 'id'
    assert "_id" not in order, f"Raw _id leaked: {order.get('_id')}"
    assert order.get("id"), "Missing 'id' field"
    assert isinstance(order["id"], str)

    bd = order.get("booking_details") or {}
    assert bd.get("departure_city") == travel_route["from_city"], bd
    assert bd.get("destination_city") == travel_route["to_city"], bd
    assert bd.get("departure_time") == travel_route["departure_time"], bd
    # Service aliases derived from departure_time
    assert bd.get("service_time") == travel_route["departure_time"], bd
    assert bd.get("travel_time") == travel_route["departure_time"], bd

    # GET /api/orders/ (list) — find same order and verify enrichment applied there too
    lr = requests.get(f"{BASE_URL}/api/orders/?limit=100", headers=customer_headers, timeout=20)
    assert lr.status_code == 200
    found = next((o for o in lr.json().get("orders", []) if o.get("id") == oid), None)
    assert found, "Created order not in list response"
    bd2 = found.get("booking_details") or {}
    assert bd2.get("departure_city") == travel_route["from_city"]
    assert bd2.get("departure_time") == travel_route["departure_time"]
    assert bd2.get("service_time") == travel_route["departure_time"]


# ---------------------------------------------------------------
# 2. Enrichment does NOT overwrite non-empty existing values
# ---------------------------------------------------------------
def test_enrichment_does_not_overwrite_existing_values(customer_headers, travel_route):
    route_id = travel_route.get("id") or travel_route.get("_id")
    custom_city = "CUSTOM_CITY_KEEPME"
    custom_time = "23:59"
    payload = {
        "service_type": "travel",
        "service_id": route_id,
        "service_name": "Preserve-existing bus",
        "total_amount": 4000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "departure_city": custom_city,
            "destination_city": "CUSTOM_DEST",
            "departure_time": custom_time,
            "travel_date": "2030-12-31",
            "passengers": [{"first_name": "TEST_Preserve", "last_name": "Iter127", "id_number": "P127"}],
        },
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=customer_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    oid = r.json().get("order_id")

    g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer_headers, timeout=20)
    assert g.status_code == 200
    bd = g.json().get("booking_details") or {}
    assert bd.get("departure_city") == custom_city, f"Overwritten: {bd}"
    assert bd.get("destination_city") == "CUSTOM_DEST"
    assert bd.get("departure_time") == custom_time
    assert bd.get("travel_date") == "2030-12-31"


# ---------------------------------------------------------------
# 3. Non-travel orders pass through unchanged (early return)
# ---------------------------------------------------------------
def test_non_travel_order_not_enriched(customer_headers):
    payload = {
        "service_type": "hotel",
        "service_id": "nonexistent-hotel-xyz",
        "service_name": "TEST Hotel",
        "total_amount": 20000,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "check_in": "2030-05-01",
            "check_out": "2030-05-03",
            "guest_name": "TEST_Hotel Iter127",
        },
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=customer_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    oid = r.json().get("order_id")

    g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer_headers, timeout=20)
    assert g.status_code == 200
    order = g.json()
    assert order.get("service_type") == "hotel"
    assert "_id" not in order
    bd = order.get("booking_details") or {}
    # No travel fields invented
    assert bd.get("departure_city") in (None, "")
    assert bd.get("travel_date") in (None, "")
    assert bd.get("service_time") in (None, "")
    # Originals preserved
    assert bd.get("check_in") == "2030-05-01"
    assert bd.get("check_out") == "2030-05-03"


# ---------------------------------------------------------------
# 4. Specific user-reported order TRV-20260421-DD7FBB28
# ---------------------------------------------------------------
def test_user_reported_order_enriched(customer_headers):
    lr = requests.get(f"{BASE_URL}/api/orders/?limit=200", headers=customer_headers, timeout=20)
    assert lr.status_code == 200
    target = next(
        (o for o in lr.json().get("orders", [])
         if o.get("order_number") == "TRV-20260421-DD7FBB28"),
        None,
    )
    if not target:
        pytest.skip("TRV-20260421-DD7FBB28 not found in customer orders")

    bd = target.get("booking_details") or {}
    # Main assertions per user report
    assert bd.get("departure_city"), f"departure_city still empty: {bd}"
    assert bd.get("destination_city"), f"destination_city still empty: {bd}"
    # Also verify via direct GET
    oid = target.get("id")
    g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer_headers, timeout=20)
    assert g.status_code == 200
    bd2 = g.json().get("booking_details") or {}
    assert bd2.get("departure_city") == bd.get("departure_city")
    assert bd2.get("departure_time") == bd.get("departure_time")
    # 'id' present, no '_id'
    assert "_id" not in g.json()
    assert g.json().get("id") == oid
