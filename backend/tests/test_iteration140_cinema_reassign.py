"""Iteration 140 backend tests
Covers:
- Cinema films POST /api/cinema/films accepts new fields (cast, trailer_url, release_date, imdb_rating, status)
- Cinema films PUT /api/cinema/films/{id} still works for simple and new fields
- Cinema showtimes POST /api/cinema/{cinema_id}/showtimes regression
- Resource reassignments presets include 'restaurant' and 'banquet'
- Packages endpoint regression (quick list)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://delivery-platform-108.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@test.com"
ADMIN_PW = "testpassword123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---- Cinema films ----
class TestCinemaFilms:
    created_id = None

    def test_create_film_with_new_fields(self, auth_headers):
        params = {
            "title": f"TEST_Film_{uuid.uuid4().hex[:6]}",
            "duration_minutes": 120,
            "genre": ["action", "drama"],
            "description": "Test film",
            "language": "English",
            "rating": "PG-13",
            "director": "Test Dir",
            "cast": ["Actor A", "Actor B"],
            "trailer_url": "https://youtube.com/trailer",
            "release_date": "2026-02-01",
            "imdb_rating": 8.4,
            "status": "now_showing",
        }
        r = requests.post(
            f"{BASE_URL}/api/cinema/films", params=params, headers=auth_headers, timeout=30
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert "film_id" in data
        TestCinemaFilms.created_id = data["film_id"]

        # Verify via GET
        g = requests.get(
            f"{BASE_URL}/api/cinema/films/{TestCinemaFilms.created_id}",
            headers=auth_headers, timeout=30,
        )
        assert g.status_code == 200
        got = g.json()
        assert got["title"] == params["title"]
        assert got["cast"] == ["Actor A", "Actor B"]
        assert got["trailer_url"] == "https://youtube.com/trailer"
        assert got["release_date"] == "2026-02-01"
        assert got["imdb_rating"] == 8.4
        assert got["status"] == "now_showing"
        assert got["director"] == "Test Dir"

    def test_update_film_simple_regression(self, auth_headers):
        assert TestCinemaFilms.created_id, "Previous create must succeed"
        r = requests.put(
            f"{BASE_URL}/api/cinema/films/{TestCinemaFilms.created_id}",
            params={"title": "TEST_Film_Updated_Simple"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        g = requests.get(
            f"{BASE_URL}/api/cinema/films/{TestCinemaFilms.created_id}",
            headers=auth_headers, timeout=30,
        )
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_Film_Updated_Simple"

    def test_update_film_new_fields(self, auth_headers):
        assert TestCinemaFilms.created_id
        r = requests.put(
            f"{BASE_URL}/api/cinema/films/{TestCinemaFilms.created_id}",
            params={
                "cast": ["Actor X"],
                "imdb_rating": 9.1,
                "status": "coming_soon",
            },
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        g = requests.get(
            f"{BASE_URL}/api/cinema/films/{TestCinemaFilms.created_id}",
            headers=auth_headers, timeout=30,
        )
        got = g.json()
        assert got["cast"] == ["Actor X"]
        assert got["imdb_rating"] == 9.1
        assert got["status"] == "coming_soon"


# ---- Cinema showtimes regression ----
class TestCinemaShowtimesRegression:
    def test_create_showtime(self, auth_headers):
        # Need an existing cinema + film
        clist = requests.get(f"{BASE_URL}/api/cinema/cinemas", timeout=30).json()
        cinemas = clist.get("cinemas", [])
        if not cinemas:
            pytest.skip("No cinema seed; cannot test showtime create")
        cinema_id = cinemas[0]["id"] if "id" in cinemas[0] else cinemas[0].get("_id")
        assert cinema_id

        # Create a film for showtime
        fp = {
            "title": f"TEST_STFilm_{uuid.uuid4().hex[:6]}",
            "duration_minutes": 100,
            "genre": ["action"],
            "rating": "PG",
        }
        fr = requests.post(
            f"{BASE_URL}/api/cinema/films", params=fp, headers=auth_headers, timeout=30
        )
        assert fr.status_code == 200, fr.text[:200]
        film_id = fr.json()["film_id"]

        sp = {
            "film_id": film_id,
            "screen_name": "Screen 1",
            "screen_type": "2d",
            "show_date": "2026-03-01",
            "show_time": "18:30",
            "end_time": "20:10",
            "price": 3500.0,
            "vip_price": 5000.0,
            "total_seats": 80,
        }
        r = requests.post(
            f"{BASE_URL}/api/cinema/{cinema_id}/showtimes",
            params=sp, headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        out = r.json()
        assert "showtime_id" in out


# ---- Resource reassignment presets for restaurant/banquet ----
class TestReassignPresets:
    def _invoke_nonexistent(self, auth_headers, service_type: str):
        body = {
            "service_type": service_type,
            "old_resource_id": f"nonexistent-old-{uuid.uuid4().hex[:6]}",
            "new_resource_id": f"nonexistent-new-{uuid.uuid4().hex[:6]}",
            "reason": "upgrade",
        }
        return requests.post(
            f"{BASE_URL}/api/operator/resources/reassign",
            json=body, headers=auth_headers, timeout=30,
        )

    def test_restaurant_preset_registered(self, auth_headers):
        r = self._invoke_nonexistent(auth_headers, "restaurant")
        # Must NOT be 400 "Reassignment not supported" — preset must exist.
        # Expect 404 "Old resource not found" since IDs don't exist.
        assert r.status_code == 404, (
            f"Expected 404 (resource not found), got {r.status_code} {r.text[:300]}"
        )
        assert "not found" in r.text.lower()

    def test_banquet_preset_registered(self, auth_headers):
        r = self._invoke_nonexistent(auth_headers, "banquet")
        assert r.status_code == 404, (
            f"Expected 404 (resource not found), got {r.status_code} {r.text[:300]}"
        )
        assert "not found" in r.text.lower()

    def test_unsupported_service_type_still_400(self, auth_headers):
        r = self._invoke_nonexistent(auth_headers, "nosuchservice")
        assert r.status_code == 400
        assert "not supported" in r.text.lower()


# ---- Packages regression (list) ----
class TestPackagesRegression:
    def test_list_packages_ok(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/packages/", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        # Accept either list or dict wrapper
        body = r.json()
        assert isinstance(body, (list, dict))
