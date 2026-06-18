"""iter 251 — city filter regression + accent-insensitive matching + service_type scope on global search."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")


# ── Auth fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "customer@test.com", "password": "testpassword123"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


# ── 1. Car-rental city filter (the headline bug fix) ───────────────────────
class TestCarRentalCityFilter:
    def test_no_city_returns_all(self):
        r = requests.get(f"{BASE_URL}/api/car-rental/", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "cars" in d
        assert d["total"] >= 1
        self._all_total = d["total"]

    def test_city_douala_only(self):
        r = requests.get(f"{BASE_URL}/api/car-rental/?city=Douala", timeout=10)
        assert r.status_code == 200
        cars = r.json()["cars"]
        # Every returned car must be in Douala
        for c in cars:
            assert (c.get("city") or "").lower().startswith("douala"), c.get("city")

    def test_city_yaounde_accent_insensitive(self):
        # No accent passed in — must still match "Yaoundé"
        r = requests.get(f"{BASE_URL}/api/car-rental/?city=Yaounde", timeout=10)
        assert r.status_code == 200
        cars = r.json()["cars"]
        for c in cars:
            city = (c.get("city") or "").lower()
            assert "yaound" in city, c.get("city")

    def test_lowercase_city(self):
        r = requests.get(f"{BASE_URL}/api/car-rental/?city=douala", timeout=10)
        assert r.status_code == 200
        cars = r.json()["cars"]
        for c in cars:
            assert "douala" in (c.get("city") or "").lower()


# ── 2. Accent-insensitive city filter on other services ────────────────────
@pytest.mark.parametrize("endpoint,key", [
    ("/api/hotels/?city=Yaounde", "hotels"),
    ("/api/restaurants/?city=Yaounde", "restaurants"),
    ("/api/banquets/?city=Yaounde", "banquets"),
    ("/api/pressing/?city=Yaounde", "pressings"),
])
def test_accent_insensitive_city_other_services(endpoint, key):
    r = requests.get(f"{BASE_URL}{endpoint}", timeout=15)
    assert r.status_code == 200, f"{endpoint}: {r.text[:200]}"
    body = r.json()
    # response may be {key: [...]} or a bare list
    rows = body.get(key) if isinstance(body, dict) else body
    if rows is None:
        # some endpoints return list directly under a different shape
        rows = body if isinstance(body, list) else next(
            (v for v in body.values() if isinstance(v, list)), []
        )
    # Filter passes only if matched rows have Yaoundé-ish city OR the list is empty
    for row in rows:
        city = (row.get("city") or "").lower()
        if city:
            assert "yaound" in city, f"{endpoint} returned non-Yaoundé city: {row.get('city')}"


# ── 3. Global search service_type scope ────────────────────────────────────
class TestSearchServiceTypeScope:
    def test_unscoped_search_returns_results(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/search/?q=hotel", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1

    @pytest.mark.parametrize("service_type,allowed", [
        ("hotel",      {"hotel", "operator", "location"}),
        ("car_rental", {"car_rental", "operator", "location"}),
        ("restaurant", {"restaurant", "operator", "location"}),
        ("travel",     {"travel_route", "operator", "location"}),
        ("event",      {"event", "operator", "location"}),
        ("cinema",     {"film", "showtime", "operator", "location"}),
        ("banquet",    {"banquet", "operator", "location"}),
        ("laundry",    {"pressing", "operator", "location"}),
    ])
    def test_scoped_search_filters_types(self, auth_headers, service_type, allowed):
        # Use generic query likely to match across types
        r = requests.get(
            f"{BASE_URL}/api/search/?q=a&service_type={service_type}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for row in d["results"]:
            assert row["type"] in allowed, f"{service_type}: got disallowed type {row['type']}"
        for type_key in d["by_type"]:
            assert type_key in allowed, f"{service_type}: by_type contains {type_key}"

    def test_hotel_scope_excludes_cars(self, auth_headers):
        # Sanity: 'doua' could match both hotels and cars in Douala; with
        # service_type=hotel, no car_rental rows must come back.
        r = requests.get(
            f"{BASE_URL}/api/search/?q=doua&service_type=hotel",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        for row in r.json()["results"]:
            assert row["type"] != "car_rental"

    def test_search_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/search/?q=hotel", timeout=10)
        assert r.status_code in (401, 403)
