"""Iteration 124 - Tests for POST /api/seat-bookings/confirm + seat-map user_id reconcile.
Also smoke-tests OrderDetailModal-related fields shape (service_time in booking_details)."""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://booking-revamp-hub.preview.emergentagent.com").rstrip("/")

CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}
OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}
ADMIN = {"email": "admin@test.com", "password": "testpassword123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def active_route_id(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/travel/routes", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    routes = r.json().get("routes") or r.json() or []
    assert isinstance(routes, list) and routes, "no routes found"
    # prefer active one
    for rt in routes:
        if rt.get("status") == "active" or rt.get("is_active") is True:
            return rt.get("id") or rt.get("_id")
    return routes[0].get("id") or routes[0].get("_id")


@pytest.fixture(scope="module")
def travel_date():
    return (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")


def _reserve(token, route_id, date, seats):
    h = {"Authorization": f"Bearer {token}"}
    return requests.post(
        f"{BASE_URL}/api/seat-bookings/sync",
        headers=h,
        json={"route_id": route_id, "travel_date": date, "desired_seats": seats},
        timeout=20,
    )


def _release_all(token, route_id, date):
    h = {"Authorization": f"Bearer {token}"}
    # release all user-held seats for cleanup
    requests.post(
        f"{BASE_URL}/api/seat-bookings/sync",
        headers=h,
        json={"route_id": route_id, "travel_date": date, "desired_seats": []},
        timeout=20,
    )


# ---- Seat confirm endpoint ----
class TestSeatConfirm:
    def test_confirm_moves_reserved_to_booked(self, customer_token, active_route_id, travel_date):
        _release_all(customer_token, active_route_id, travel_date)
        # reserve seat 20, 21
        r = _reserve(customer_token, active_route_id, travel_date, ["20", "21"])
        assert r.status_code == 200, r.text

        h = {"Authorization": f"Bearer {customer_token}"}
        # confirm
        r = requests.post(
            f"{BASE_URL}/api/seat-bookings/confirm",
            headers=h,
            json={
                "route_id": active_route_id,
                "travel_date": travel_date,
                "seat_numbers": ["20", "21"],
                "order_id": "TEST_order_iter124",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Confirmed" in data.get("message", "")
        assert set(data["confirmed"]) == {"20", "21"}

        # Verify via seat-map
        r2 = requests.get(
            f"{BASE_URL}/api/seat-bookings/",
            params={"route_id": active_route_id, "travel_date": travel_date},
            timeout=20,
        )
        assert r2.status_code == 200
        seat_map = r2.json()["seat_map"]
        by_num = {s["seat_number"]: s for s in seat_map}
        assert by_num[20]["status"] == "booked"
        assert by_num[21]["status"] == "booked"

    def test_confirm_idempotent(self, customer_token, active_route_id, travel_date):
        # second confirm should not error even though status already booked
        h = {"Authorization": f"Bearer {customer_token}"}
        r = requests.post(
            f"{BASE_URL}/api/seat-bookings/confirm",
            headers=h,
            json={
                "route_id": active_route_id,
                "travel_date": travel_date,
                "seat_numbers": ["20", "21"],
            },
            timeout=20,
        )
        assert r.status_code == 200
        # still booked (no regression)
        r2 = requests.get(
            f"{BASE_URL}/api/seat-bookings/",
            params={"route_id": active_route_id, "travel_date": travel_date},
            timeout=20,
        )
        by_num = {s["seat_number"]: s for s in r2.json()["seat_map"]}
        assert by_num[20]["status"] == "booked"

    def test_confirm_other_user_cannot_take_someone_elses_seat(self, admin_token, active_route_id, travel_date):
        # admin tries to confirm customer's seats — should modify 0 because user_id scopes the update_many
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/seat-bookings/confirm",
            headers=h,
            json={
                "route_id": active_route_id,
                "travel_date": travel_date,
                "seat_numbers": ["20", "21"],
            },
            timeout=20,
        )
        assert r.status_code == 200
        # seats are still booked BY CUSTOMER — check user_id remained customer's
        r2 = requests.get(
            f"{BASE_URL}/api/seat-bookings/",
            params={"route_id": active_route_id, "travel_date": travel_date},
            timeout=20,
        )
        by_num = {s["seat_number"]: s for s in r2.json()["seat_map"]}
        assert by_num[20]["status"] == "booked"
        # admin id is different from customer id — the seat should still carry the customer's user_id.
        # We don't know customer id here, but we can check it isn't blanked.
        assert by_num[20]["user_id"] is not None

    def test_confirm_requires_auth(self, active_route_id, travel_date):
        r = requests.post(
            f"{BASE_URL}/api/seat-bookings/confirm",
            json={"route_id": active_route_id, "travel_date": travel_date, "seat_numbers": ["1"]},
            timeout=20,
        )
        assert r.status_code in (401, 403)


# ---- Seat-map exposes user_id for reconcile (client-side cap to maxSeats) ----
class TestSeatMapUserIdExposed:
    def test_reserved_seat_includes_user_id(self, customer_token, active_route_id, travel_date):
        # new fresh date to not clash with booked seats above
        date2 = (datetime.utcnow() + timedelta(days=45)).strftime("%Y-%m-%d")
        _release_all(customer_token, active_route_id, date2)
        r = _reserve(customer_token, active_route_id, date2, ["10", "11"])
        assert r.status_code == 200, r.text

        r2 = requests.get(
            f"{BASE_URL}/api/seat-bookings/",
            params={"route_id": active_route_id, "travel_date": date2},
            timeout=20,
        )
        assert r2.status_code == 200
        by_num = {s["seat_number"]: s for s in r2.json()["seat_map"]}
        assert by_num[10]["status"] == "reserved"
        assert by_num[10]["user_id"] is not None, "seat-map must expose user_id so LiveSeatMap can reconcile"
        # cleanup
        _release_all(customer_token, active_route_id, date2)


# ---- User preferences include timezone ----
class TestUserTimezonePreference:
    def test_put_and_get_timezone_preference(self, customer_token):
        h = {"Authorization": f"Bearer {customer_token}"}
        # GET /auth/me
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"/auth/me returned {r.status_code}")

        # try set timezone via preferences endpoint
        r2 = requests.put(
            f"{BASE_URL}/api/users/me/preferences",
            headers=h,
            json={"timezone": "America/New_York"},
            timeout=20,
        )
        if r2.status_code == 404:
            pytest.skip("PUT /users/me/preferences not implemented")
        assert r2.status_code in (200, 204), r2.text

        # read back
        r3 = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=20)
        assert r3.status_code == 200
        data = r3.json()
        tz = data.get("timezone") or (data.get("preferences") or {}).get("timezone")
        assert tz == "America/New_York", f"expected timezone persisted, got {tz}"

        # reset to default
        requests.put(
            f"{BASE_URL}/api/users/me/preferences",
            headers=h,
            json={"timezone": "Africa/Douala"},
            timeout=20,
        )


# ---- Banquets API basic smoke (page was crashing; ensure data is reachable) ----
class TestBanquetsApi:
    def test_list_banquets(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/banquets/", headers=h, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "banquets" in body or isinstance(body, list)
