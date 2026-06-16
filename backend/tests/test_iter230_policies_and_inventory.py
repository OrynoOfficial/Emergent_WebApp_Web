"""
Tests for iter 230 — policies fields + inventory engine.
"""
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def test_hotel_create_with_policies():
    """POST /api/hotels accepts and persists `policies` field."""
    token = _login("admin@test.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": f"TestPolicyHotel-{uuid.uuid4().hex[:8]}",
        "address": "123 Test Lane",
        "city": "Douala",
        "country": "Cameroon",
        "star_rating": 4,
        "policies": ["Check-in 14:00", "Check-out 12:00", "No pets"],
    }
    r = requests.post(f"{BASE_URL}/api/hotels", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    hotel_id = r.json().get("hotel_id") or r.json().get("id")
    assert hotel_id

    r2 = requests.get(f"{BASE_URL}/api/hotels/{hotel_id}", headers=headers, timeout=30)
    assert r2.status_code == 200
    data = r2.json()
    assert data.get("policies") == ["Check-in 14:00", "Check-out 12:00", "No pets"]


def test_car_rental_create_with_policies_and_units():
    """POST /api/car-rental/ accepts `policies` + `total_units` and they round-trip."""
    token = _login("admin@test.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "make": "TestCar", "model": f"Z-{uuid.uuid4().hex[:6]}", "year": 2024,
        "vehicle_type": "sedan", "seats": 4, "doors": 4,
        "transmission": "automatic", "fuel_type": "petrol",
        "price_per_day": 25000.0, "city": "Douala",
        "policies": ["Driver must be 25+", "No smoking inside"],
        "total_units": 5,
    }
    r = requests.post(f"{BASE_URL}/api/car-rental/", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    car_id = r.json().get("car_id")
    assert car_id

    r2 = requests.get(f"{BASE_URL}/api/car-rental/{car_id}", headers=headers, timeout=30)
    assert r2.status_code == 200
    data = r2.json()
    assert data.get("policies") == ["Driver must be 25+", "No smoking inside"]
    assert data.get("total_units") == 5


def test_inventory_banquet_item_crud_and_hold_lifecycle():
    """End-to-end: create banquet item → create hold → list holds → confirm return.

    Validates that available_units decreases on hold and recovers on return
    (minus damaged_quantity which is permanently removed from total_units).
    """
    token = _login("superadmin@oryno.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a banquet item with 100 chairs
    r = requests.post(f"{BASE_URL}/api/inventory/banquet-items", headers=headers, json={
        "name": f"TestChair-{uuid.uuid4().hex[:6]}",
        "description": "Gold Chiavari Chair",
        "category": "seating",
        "unit_price": 500,
        "total_units": 100,
        "policies": ["Damage fee: XAF 5000 per chair"],
    }, timeout=30)
    assert r.status_code == 200, r.text
    item_id = r.json()["id"]

    # 2. Create a hold of 30 chairs
    r2 = requests.post(f"{BASE_URL}/api/inventory/holds", headers=headers, json={
        "entity_type": "banquet_item",
        "entity_id": item_id,
        "quantity": 30,
        "start_date": "2026-08-01",
        "end_date": "2026-08-02",
    }, timeout=30)
    assert r2.status_code == 200, r2.text
    hold_id = r2.json()["hold_id"]

    # 3. Stock summary should show 70 available
    r3 = requests.get(f"{BASE_URL}/api/inventory/banquet_item/{item_id}/stock", timeout=30)
    assert r3.status_code == 200
    assert r3.json()["available_units"] == 70
    assert r3.json()["total_units"] == 100

    # 4. Confirm return with 2 damaged
    r4 = requests.post(f"{BASE_URL}/api/inventory/holds/{hold_id}/confirm-return",
                       headers=headers, json={"damaged_quantity": 2, "operator_note": "2 broken legs"}, timeout=30)
    assert r4.status_code == 200, r4.text

    # 5. Stock summary should show 98 total (2 removed), 98 available
    r5 = requests.get(f"{BASE_URL}/api/inventory/banquet_item/{item_id}/stock", timeout=30)
    assert r5.status_code == 200
    s = r5.json()
    assert s["total_units"] == 98
    assert s["available_units"] == 98


def test_inventory_rejects_oversubscription():
    """Trying to hold more than available_units should 409."""
    token = _login("superadmin@oryno.com", "testpassword123")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE_URL}/api/inventory/banquet-items", headers=headers, json={
        "name": f"TestPlate-{uuid.uuid4().hex[:6]}",
        "category": "tableware",
        "unit_price": 200,
        "total_units": 10,
    }, timeout=30)
    item_id = r.json()["id"]

    # 1st hold — ok
    r1 = requests.post(f"{BASE_URL}/api/inventory/holds", headers=headers, json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 8,
    }, timeout=30)
    assert r1.status_code == 200

    # 2nd hold — only 2 left → asking for 5 must fail
    r2 = requests.post(f"{BASE_URL}/api/inventory/holds", headers=headers, json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 5,
    }, timeout=30)
    assert r2.status_code == 409, r2.text
