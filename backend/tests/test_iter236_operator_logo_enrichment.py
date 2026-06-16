"""
Iter 236 — `operator_logo_url` enrichment for Hotel/CarRental/Banquet listings.

The travel-routes endpoint already enriched (iter 235). This iteration extends
the same batch-load pattern to the other three customer-facing catalogs so
every card / detail page across the platform can render the operator's brand
without an extra round-trip.
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


def _set_logo(url: str) -> None:
    requests.put(f"{API}/api/operators/{OP_ID}", json={"logo_url": url}, headers=_super())


def test_hotels_listing_carries_operator_logo_url():
    h = _super()
    test_logo = f"https://logo.test/hotels-{uuid.uuid4().hex[:6]}.png"
    _set_logo(test_logo)
    # Make sure at least one hotel exists for this operator.
    r = requests.post(f"{API}/api/hotels/", json={
        "name": f"Pytest Logo Hotel {uuid.uuid4().hex[:6]}",
        "address": "Test", "city": "Douala", "country": "Cameroon",
        "star_rating": 3, "phone": "+237600000000", "email": "t@t.t",
        "amenities": [], "images": [], "operator_id": OP_ID,
    }, headers=h)
    assert r.status_code == 200, r.text
    hotel_id = r.json().get("hotel_id") or r.json().get("id")

    # Listing
    r = requests.get(f"{API}/api/hotels/", params={"limit": 200})
    assert r.status_code == 200
    hotels = r.json().get("hotels", [])
    matches = [hh for hh in hotels if hh.get("operator_id") == OP_ID]
    assert matches, "Need ≥1 hotel for the test operator"
    assert any(hh.get("operator_logo_url") == test_logo for hh in matches)

    # Detail
    r = requests.get(f"{API}/api/hotels/{hotel_id}")
    assert r.status_code == 200
    assert r.json().get("operator_logo_url") == test_logo


def test_car_rental_listing_carries_operator_logo_url():
    h = _super()
    test_logo = f"https://logo.test/cars-{uuid.uuid4().hex[:6]}.png"
    _set_logo(test_logo)
    r = requests.post(f"{API}/api/car-rental/", json={
        "make": "Pytest", "model": f"Logo {uuid.uuid4().hex[:5]}",
        "year": 2025, "vehicle_type": "compact", "seats": 4, "doors": 4,
        "transmission": "automatic", "fuel_type": "petrol",
        "price_per_day": 30000, "city": "Douala", "operator_id": OP_ID,
        "total_units": 1,
    }, headers=h)
    assert r.status_code == 200, r.text
    car_id = r.json()["car_id"]

    r = requests.get(f"{API}/api/car-rental/")
    assert r.status_code == 200
    cars = r.json().get("cars", [])
    matches = [c for c in cars if c.get("operator_id") == OP_ID]
    assert matches
    assert any(c.get("operator_logo_url") == test_logo for c in matches)

    r = requests.get(f"{API}/api/car-rental/{car_id}")
    assert r.status_code == 200
    assert r.json().get("operator_logo_url") == test_logo


def test_banquets_listing_carries_operator_logo_url():
    h = _super()
    test_logo = f"https://logo.test/banquets-{uuid.uuid4().hex[:6]}.png"
    _set_logo(test_logo)
    r = requests.post(f"{API}/api/banquets/", json={
        "name": f"Pytest Logo Hall {uuid.uuid4().hex[:6]}",
        "category": "hall", "pricing_model": "per_event",
        "base_price": 250000, "operator_id": OP_ID,
        "city": "Douala",
    }, headers=h)
    assert r.status_code == 200, r.text
    banquet_id = r.json()["banquet_id"]

    r = requests.get(f"{API}/api/banquets/")
    assert r.status_code == 200
    venues = r.json().get("banquets", [])
    matches = [b for b in venues if b.get("operator_id") == OP_ID]
    assert matches
    assert any(b.get("operator_logo_url") == test_logo for b in matches)

    r = requests.get(f"{API}/api/banquets/{banquet_id}")
    assert r.status_code == 200
    assert r.json().get("operator_logo_url") == test_logo
