"""
Iter 234 — Hotel check_in_time / check_out_time fields.

The Hotel Booking summary sidebar used to render hardcoded "From 14:00" /
"Before 12:00" labels. Operators can now set those strings on the Hotel
model itself; the booking page reads the values, falling back to the
defaults if unset.
"""
import os
import uuid
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


def _admin():
    r = requests.post(f"{API}/api/auth/login", json={"email": "admin@test.com", "password": "testpassword123"}).json()
    return {"Authorization": f"Bearer {r.get('access_token') or r.get('token')}"}


def test_hotel_check_in_check_out_times_persist():
    h = _admin()
    name = f"Pytest Hotel {uuid.uuid4().hex[:6]}"
    payload = {
        "name": name,
        "address": "123 Pytest Ave",
        "city": "Douala",
        "country": "Cameroon",
        "star_rating": 4,
        "phone": "+237600000000",
        "email": "test@hotel.test",
        "amenities": ["wifi", "pool"],
        "images": [],
        "policies": ["No smoking", "Pets allowed"],
        "check_in_time": "From 16:00",
        "check_out_time": "Before 11:00",
    }
    r = requests.post(f"{API}/api/hotels/", json=payload, headers=h)
    assert r.status_code == 200, r.text
    hotel_id = r.json().get("hotel_id") or r.json().get("id") or r.json().get("_id")
    assert hotel_id

    # Round-trip: GET should return the same custom strings.
    r = requests.get(f"{API}/api/hotels/{hotel_id}")
    assert r.status_code == 200
    body = r.json()
    assert body.get("check_in_time") == "From 16:00"
    assert body.get("check_out_time") == "Before 11:00"
    # And the policies array still carries the rest.
    assert "No smoking" in (body.get("policies") or [])
