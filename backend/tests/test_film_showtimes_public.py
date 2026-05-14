"""
Tests for the public endpoint GET /api/cinema/films/{film_id}/showtimes.
Verifies enrichment (cinema_name, screen_type), soft-delete exclusion,
and the optional ?city= scoping (case-insensitive).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
FILM_ID = "1edf5c04-f19a-4808-9b3c-b8e168e8dc02"  # Olympus has Fallen / PH-Netflix


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Endpoint base behaviour ----

class TestFilmShowtimesPublic:
    def test_unknown_film_returns_404(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/does-not-exist/showtimes")
        assert r.status_code == 404

    def test_returns_active_showtimes_with_enrichment(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "showtimes" in data and "total" in data
        sts = data["showtimes"]
        assert isinstance(sts, list)
        assert data["total"] == len(sts)
        assert len(sts) > 0, "Seed has at least one active showtime"

        for s in sts:
            # id key renamed from _id
            assert "id" in s and isinstance(s["id"], str)
            assert "_id" not in s
            assert s.get("film_id") == FILM_ID
            # Soft-deleted excluded
            assert s.get("is_active") is not False
            # Enrichment fields used by FE
            assert "cinema_name" in s and s["cinema_name"], "cinema_name enrichment missing"
            assert "screen_type" in s, "screen_type field missing"
            # Fields needed by ShowtimeCard
            for key in ("show_date", "show_time", "price"):
                assert key in s, f"{key} missing on showtime"

    def test_results_sorted_by_date_then_time(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes")
        assert r.status_code == 200
        sts = r.json()["showtimes"]
        keys = [(s.get("show_date", ""), s.get("show_time", "")) for s in sts]
        assert keys == sorted(keys), "Showtimes must be sorted ascending by (date,time)"

    def test_cinema_name_is_ph_netflix(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes")
        sts = r.json()["showtimes"]
        names = {s["cinema_name"] for s in sts}
        assert "PH-Netflix" in names


# ---- City scoping ----

class TestCityScoping:
    def test_city_matching_returns_results(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", params={"city": "Edea"})
        assert r.status_code == 200
        assert r.json()["total"] > 0

    def test_city_case_insensitive(self, client):
        r1 = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", params={"city": "Edea"})
        r2 = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", params={"city": "edea"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["total"] == r2.json()["total"]
        assert r1.json()["total"] > 0

    def test_unknown_city_returns_empty(self, client):
        r = client.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", params={"city": "Atlantis_999"})
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 0
        assert body["showtimes"] == []
