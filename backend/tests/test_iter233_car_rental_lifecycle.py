"""
Iter 233 — Car Rental Return/Damage lifecycle parity.

Wires `POST /api/car-rental/book` to the shared inventory engine so every
booking creates an inventory_hold against the vehicle. Tests:
  * Booking creates a hold and drops available_units
  * Booking a fully-reserved vehicle returns 409
  * Confirm-return with damaged_quantity=1 + damage_fee bills the order
    and removes the vehicle from total_units
"""
import os
import uuid
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


def _login(email, password):
    return requests.post(f"{API}/api/auth/login", json={"email": email, "password": password}).json().get("access_token")


def _admin():
    return {"Authorization": f"Bearer {_login('admin@test.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def _make_car(total_units=1):
    h = _admin()
    r = requests.post(f"{API}/api/car-rental/", json={
        "make": "Pytest", "model": f"Hatch {uuid.uuid4().hex[:5]}",
        "year": 2024, "vehicle_type": "compact", "seats": 4, "doors": 4,
        "transmission": "automatic", "fuel_type": "petrol",
        "price_per_day": 25000, "city": "Douala", "operator_id": OP_ID,
        "total_units": total_units,
    }, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["car_id"]


def _book_car(car_id):
    return requests.post(f"{API}/api/car-rental/book", json={
        "vehicle_id": car_id, "vehicle_name": "Pytest Hatch",
        "pickup_date": "2026-12-20", "return_date": "2026-12-23",
        "pickup_location": "Douala Airport",
        "driver_name": "Test Driver", "driver_email": "drv@test.com",
        "driver_phone": "+237600000099", "driver_license": "ABC123",
        "driver_address": "Test", "extras": [], "base_price": 75000,
        "extras_price": 0, "commission": 7500, "total_amount": 82500,
    }, headers=_customer())


def test_car_booking_creates_hold_and_drops_stock():
    car_id = _make_car(total_units=2)
    s = requests.get(f"{API}/api/inventory/car_rental/{car_id}/stock").json()
    assert s["total_units"] == 2 and s["available_units"] == 2

    r = _book_car(car_id)
    assert r.status_code == 200, r.text
    assert r.json().get("inventory_hold_id")

    s = requests.get(f"{API}/api/inventory/car_rental/{car_id}/stock").json()
    assert s["available_units"] == 1, f"Expected 1 available, got {s}"


def test_car_booking_overbook_returns_409():
    car_id = _make_car(total_units=1)
    r = _book_car(car_id)
    assert r.status_code == 200
    r2 = _book_car(car_id)
    assert r2.status_code == 409
    assert "fully booked" in r2.json()["detail"].lower()


def test_car_return_with_damage_decrements_fleet():
    car_id = _make_car(total_units=3)
    book = _book_car(car_id).json()
    hold_id = book["inventory_hold_id"]

    # Confirm return with damaged_quantity=1 and damage_fee
    r = requests.post(f"{API}/api/inventory/holds/{hold_id}/confirm-return", json={
        "damaged_quantity": 1, "damage_fee": 125000,
        "damage_description": "Side panel scratched, mirror cracked",
    }, headers=_admin())
    assert r.status_code == 200, r.text
    assert r.json()["damaged_units_removed_from_stock"] == 1
    assert r.json()["damage_fee_applied"] == 125000

    # total_units should drop 3 → 2
    s = requests.get(f"{API}/api/inventory/car_rental/{car_id}/stock").json()
    assert s["total_units"] == 2, f"Expected total_units=2, got {s}"
