"""Iteration 172 — verify customer_rating aggregation on
GET /api/cinema/films and GET /api/cinema/films/{film_id}.

Seeded data:
  - film id 1edf5c04-f19a-4808-9b3c-b8e168e8dc02 ('Olympus has Fallen') has
    3 entries in db.ratings (entity_type='film')
  - film id a585484d-... ('Avenger / Avengers') has no customer ratings →
    customer_rating should be null and count 0
"""
import os
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
OLYMPUS_ID = "1edf5c04-f19a-4808-9b3c-b8e168e8dc02"


class TestCinemaFilmsListCustomerRating:
    def test_list_returns_customer_rating_fields(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("films"), list) and data["films"]
        for f in data["films"]:
            assert "customer_rating" in f
            assert "customer_rating_count" in f
            assert isinstance(f["customer_rating_count"], int)

    def test_olympus_has_three_ratings(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
        data = r.json()
        olympus = next((f for f in data["films"] if (f.get("id") == OLYMPUS_ID) or f.get("title") == "Olympus has Fallen"), None)
        assert olympus is not None, "seeded Olympus film not found"
        assert olympus["customer_rating_count"] == 3, olympus
        # Average should be a float rounded to 1dp and within 1..5 range
        assert isinstance(olympus["customer_rating"], (int, float))
        assert 1.0 <= olympus["customer_rating"] <= 5.0
        # Check it's rounded to 1 decimal
        assert round(float(olympus["customer_rating"]), 1) == olympus["customer_rating"]

    def test_film_without_ratings_returns_null_and_zero(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
        data = r.json()
        unrated = [f for f in data["films"] if f.get("id") != OLYMPUS_ID and f.get("title") != "Olympus has Fallen"]
        # At least one film should have no customer ratings (Avenger per seed)
        assert any(
            f["customer_rating"] is None and f["customer_rating_count"] == 0
            for f in unrated
        ), "expected at least one film with no customer ratings"


class TestCinemaSingleFilmCustomerRating:
    def test_single_film_olympus_carries_rating(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films/{OLYMPUS_ID}", timeout=30)
        assert r.status_code == 200, r.text
        f = r.json()
        assert f.get("customer_rating_count") == 3
        assert isinstance(f.get("customer_rating"), (int, float))
        assert 1.0 <= f["customer_rating"] <= 5.0

    def test_single_film_unrated_returns_null(self):
        # Find another film via the list, then GET it singly
        r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
        data = r.json()
        unrated = next(
            (f for f in data["films"] if f.get("customer_rating_count") == 0 and f.get("id")),
            None,
        )
        if unrated is None:
            import pytest
            pytest.skip("No unrated film available for singleton check")
        r2 = requests.get(f"{BASE_URL}/api/cinema/films/{unrated['id']}", timeout=30)
        assert r2.status_code == 200
        single = r2.json()
        assert single["customer_rating"] is None
        assert single["customer_rating_count"] == 0

    def test_unknown_film_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films/__nope__", timeout=30)
        assert r.status_code == 404
