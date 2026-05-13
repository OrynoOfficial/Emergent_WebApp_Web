"""Tests for GET /api/cinema/films enrichment (cinema_names + price_from).

Verifies the new fields surfaced for /services/cinema/results:
  - films carry `cinema_names` (list of unique cinema names with active showtimes)
  - films carry `price_from` (min price across active showtimes)
  - the `city` query restricts which cinemas/showtimes contribute
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def all_films():
    r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


class TestFilmsEnrichmentBaseline:
    def test_response_shape(self, all_films):
        assert "films" in all_films and "total" in all_films
        assert isinstance(all_films["films"], list)

    def test_each_film_has_cinema_names_list(self, all_films):
        for f in all_films["films"]:
            assert "cinema_names" in f, f"film {f.get('title')} missing cinema_names"
            assert isinstance(f["cinema_names"], list)

    def test_film_with_active_showtimes_has_price_from(self, all_films):
        # Per the seed: 'Olympus has Fallen' has 1 active showtime at price 7500.
        target = next((f for f in all_films["films"] if f.get("title") == "Olympus has Fallen"), None)
        if target is None:
            pytest.skip("Seed film 'Olympus has Fallen' not present in this environment")
        assert target.get("price_from") is not None
        assert isinstance(target["price_from"], (int, float))
        assert target["price_from"] > 0
        assert "PH-Netflix" in (target.get("cinema_names") or [])


class TestFilmsCityFilter:
    def test_city_with_showtimes_returns_film(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", params={"city": "Edea"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        f = data["films"][0]
        assert "PH-Netflix" in (f.get("cinema_names") or [])
        assert f.get("price_from") == 7500.0

    def test_city_without_showtimes_returns_empty(self):
        # Buea has Nzamzam Conerie but no active showtimes
        r = requests.get(f"{BASE_URL}/api/cinema/films", params={"city": "Buea"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert data["films"] == []

    def test_city_with_no_matching_cinemas_returns_empty(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", params={"city": "Douala"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0

    def test_completely_bogus_city(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", params={"city": "Atlantis_City_999"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data == {"films": [], "total": 0} or (data["total"] == 0)


class TestFilmsCaseInsensitiveCity:
    def test_city_case_insensitive(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", params={"city": "edea"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert "PH-Netflix" in (data["films"][0].get("cinema_names") or [])
