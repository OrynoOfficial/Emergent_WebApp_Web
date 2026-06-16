"""Tests for iter225:
- POST /api/travel/routes accepts and persists pickup_address / pickup_lat / pickup_lon
- POST /api/hotels and PUT /api/hotels/{id} accept and persist latitude / longitude
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for env load
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def operator_token():
    return _login("operator@test.com", "testpassword123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@test.com", "testpassword123")


# ---------- TRAVEL ROUTES ----------

class TestTravelRoutePickup:
    def test_create_route_with_pickup_fields(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "from_city": "TEST_Yaounde",
            "to_city": "TEST_Douala",
            "departure_time": "08:00",
            "arrival_time": "12:00",
            "duration": "4h",
            "price": 7500,
            "vehicle_type": "normal",
            "total_seats": 40,
            "amenities": ["wifi"],
            "pickup_address": "TEST_Mvan Bus Terminal",
            "pickup_lat": 3.8480,
            "pickup_lon": 11.5021,
        }
        r = requests.post(f"{BASE_URL}/api/travel/routes", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text}"
        route_id = r.json().get("route_id")
        assert route_id

        # GET to verify persistence
        r2 = requests.get(f"{BASE_URL}/api/travel/routes/{route_id}", timeout=30)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("pickup_address") == "TEST_Mvan Bus Terminal"
        assert data.get("pickup_lat") == 3.8480
        assert data.get("pickup_lon") == 11.5021

        # Cleanup
        requests.delete(f"{BASE_URL}/api/travel/routes/{route_id}", headers=headers, timeout=30)

    def test_create_route_without_pickup_fields_still_works(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "from_city": "TEST_A",
            "to_city": "TEST_B",
            "departure_time": "10:00",
            "arrival_time": "11:00",
            "duration": "1h",
            "price": 1000,
            "vehicle_type": "normal",
            "total_seats": 10,
        }
        r = requests.post(f"{BASE_URL}/api/travel/routes", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        route_id = r.json().get("route_id")
        assert route_id

        r2 = requests.get(f"{BASE_URL}/api/travel/routes/{route_id}", timeout=30)
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("pickup_address") is None
        assert data.get("pickup_lat") is None

        requests.delete(f"{BASE_URL}/api/travel/routes/{route_id}", headers=headers, timeout=30)


# ---------- HOTELS ----------

class TestHotelCoordinates:
    def test_create_hotel_with_lat_lon(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "name": "TEST_HotelCoords",
            "address": "1 Test St",
            "city": "Douala",
            "country": "Cameroon",
            "star_rating": 4,
            "latitude": 4.0511,
            "longitude": 9.7679,
        }
        r = requests.post(f"{BASE_URL}/api/hotels/", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        hotel_id = r.json().get("hotel_id")
        assert hotel_id

        r2 = requests.get(f"{BASE_URL}/api/hotels/{hotel_id}", timeout=30)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        # This is the critical assertion - lat/lon must persist on create
        assert data.get("latitude") == 4.0511, f"latitude not persisted on POST. body keys: {list(data.keys())}"
        assert data.get("longitude") == 9.7679, "longitude not persisted on POST"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/hotels/{hotel_id}?hard=true", headers=headers, timeout=30)

    def test_update_hotel_lat_lon(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Create plain hotel
        create = requests.post(f"{BASE_URL}/api/hotels/", headers=headers, json={
            "name": "TEST_HotelUpdateCoords",
            "address": "2 Test St", "city": "Douala", "country": "Cameroon",
        }, timeout=30)
        assert create.status_code in (200, 201), create.text
        hotel_id = create.json()["hotel_id"]

        # PUT with lat/lon
        r = requests.put(f"{BASE_URL}/api/hotels/{hotel_id}", headers=headers, json={
            "latitude": 5.0, "longitude": 10.0,
        }, timeout=30)
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{BASE_URL}/api/hotels/{hotel_id}", timeout=30)
        data = r2.json()
        assert data.get("latitude") == 5.0
        assert data.get("longitude") == 10.0

        requests.delete(f"{BASE_URL}/api/hotels/{hotel_id}?hard=true", headers=headers, timeout=30)
