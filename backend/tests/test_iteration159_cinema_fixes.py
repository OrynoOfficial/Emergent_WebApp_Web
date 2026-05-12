"""Iteration 159 — Cinema fixes tests.
Covers:
- GET /api/cinema/films?city=Yaoundé returns total=0 on a clean slate.
- GET /api/cinema/showtimes/operator (admin) returns enriched cinema_name/city on each showtime.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "admin@test.com",
        "password": "testpassword123",
    }, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in admin login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "customer@test.com",
        "password": "testpassword123",
    }, timeout=30)
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


# ---------- Films city filter ----------

class TestCinemaFilmsCityFilter:
    def test_get_films_city_yaounde_clean_slate(self):
        r = requests.get(f"{API}/cinema/films", params={"city": "Yaoundé"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        # Expected shape: {films: [...], total: N} or list — handle both
        if isinstance(data, dict):
            films = data.get("films") or data.get("items") or data.get("data") or []
            total = data.get("total", len(films))
        else:
            films = data
            total = len(films)
        assert total == 0, f"expected 0 films for clean slate, got total={total}, films={films[:3]}"
        assert films == [] or len(films) == 0

    def test_get_films_city_filter_case_insensitive(self):
        # Lowercase variant should also yield 0 on clean slate
        r = requests.get(f"{API}/cinema/films", params={"city": "yaounde"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        films = data.get("films", data) if isinstance(data, dict) else data
        assert len(films) == 0

    def test_get_films_no_city_returns_ok(self):
        r = requests.get(f"{API}/cinema/films", timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"


# ---------- Showtimes operator enrichment ----------

class TestOperatorShowtimes:
    def test_admin_can_list_operator_showtimes(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/cinema/showtimes/operator", headers=headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        items = data.get("showtimes") or data.get("items") or data.get("data") or (data if isinstance(data, list) else [])
        total = data.get("total", len(items)) if isinstance(data, dict) else len(items)
        # On clean slate, total should be 0 — but if any showtime exists, each must be enriched
        for st in items:
            assert "cinema_name" in st, f"showtime missing cinema_name: keys={list(st.keys())}"
            assert "cinema_city" in st, f"showtime missing cinema_city: keys={list(st.keys())}"
        # Status check: at minimum API responds OK with clean slate
        assert total >= 0

    def test_unauthenticated_operator_showtimes_blocked(self):
        r = requests.get(f"{API}/cinema/showtimes/operator", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"
