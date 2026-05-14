"""Iteration 168 — Cinema showtime hard-delete + film/showtimes 500 fix.

Covers:
- GET /api/cinema/films/{film_id}/showtimes returns 200 with total>=21 for the
  Olympus has Fallen film (1edf5c04-f19a-4808-9b3c-b8e168e8dc02). All returned
  showtime IDs must be strings (no leaked ObjectId from legacy _id values).
- DELETE /api/cinema/showtimes/{id} HARD-deletes the document. After deletion
  GET details returns 404 and the showtime is missing from both
  /cinemas/{id}/showtimes and /films/{film_id}/showtimes.
- DELETE is refused with 409 when an active booking references the showtime.

A disposable showtime is created (and torn down) for the delete tests. The 21
production showtimes for Olympus must remain untouched.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

OLYMPUS_FILM_ID = "1edf5c04-f19a-4808-9b3c-b8e168e8dc02"


# ---------------- auth helpers ----------------

def _login(email: str, password: str = "testpassword123") -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:300]}"
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    assert tok, f"no token in login response: {body}"
    return tok


@pytest.fixture(scope="module")
def operator_token():
    return _login("mani-monroe@netflix.com")


@pytest.fixture(scope="module")
def customer_token():
    return _login("customer@test.com")


@pytest.fixture(scope="module")
def operator_cinema(operator_token):
    """Return a cinema document owned by the operator (used as the host for
    disposable showtimes)."""
    r = requests.get(
        f"{API}/cinema/management/my-cinemas",
        headers={"Authorization": f"Bearer {operator_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"GET cinemas failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    cinemas = data if isinstance(data, list) else (data.get("cinemas") or data.get("items") or [])
    assert cinemas, "operator has no cinemas — cannot create disposable showtime"
    # Pick one with at least one screen if possible.
    chosen = next((c for c in cinemas if (c.get("screens") or [])), cinemas[0])
    return chosen


def _create_disposable_showtime(operator_token: str, cinema: dict, film_id: str = OLYMPUS_FILM_ID) -> str:
    screen_name = "TEST_SCREEN_168"
    screens = cinema.get("screens") or []
    if screens:
        screen_name = screens[0].get("name") or screen_name
    payload = {
        "cinema_id": cinema["id"] if "id" in cinema else cinema["_id"],
        "film_id": film_id,
        "screen_name": screen_name,
        "screen_type": "2d",
        # Use a far future date so it never collides with the 21 production rows.
        "show_date": "2099-12-31",
        "show_time": f"23:{str(abs(hash(uuid.uuid4())) % 60).zfill(2)}",
        "end_time": "23:59",
        "price": 1.0,
        "total_seats": 10,
    }
    r = requests.post(
        f"{API}/cinema/showtimes",
        json=payload,
        headers={"Authorization": f"Bearer {operator_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"create showtime failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    sid = body.get("showtime_id") or body.get("id")
    assert sid, f"no showtime_id in create response: {body}"
    return sid


# ---------------- GET /films/{film_id}/showtimes ----------------

class TestFilmShowtimesPublic:
    def test_olympus_showtimes_returns_200_and_at_least_21(self):
        r = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        body = r.json()
        total = body.get("total")
        showtimes = body.get("showtimes") or []
        assert isinstance(showtimes, list)
        assert total == len(showtimes)
        assert total >= 21, f"expected >=21 showtimes for Olympus, got {total}"

    def test_all_ids_are_strings_no_objectid_leak(self):
        r = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", timeout=30)
        assert r.status_code == 200
        for s in r.json().get("showtimes", []):
            assert "id" in s, f"showtime missing id: {s}"
            assert isinstance(s["id"], str), f"non-string id leaked: {s['id']!r} ({type(s['id'])})"
            # _id must have been popped.
            assert "_id" not in s, f"_id leaked into response: {s}"

    def test_unknown_film_returns_404(self):
        r = requests.get(f"{API}/cinema/films/__does_not_exist__/showtimes", timeout=30)
        assert r.status_code == 404


# ---------------- DELETE hard-delete behaviour ----------------

class TestShowtimeHardDelete:
    def test_hard_delete_removes_from_all_listings(self, operator_token, operator_cinema):
        sid = _create_disposable_showtime(operator_token, operator_cinema)
        cinema_id = operator_cinema.get("id") or operator_cinema.get("_id")

        # Sanity: the new showtime is visible via the public film stream.
        r = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", timeout=30)
        assert r.status_code == 200
        ids_before = {s["id"] for s in r.json().get("showtimes", [])}
        assert sid in ids_before, "disposable showtime not visible before delete"

        # DELETE
        r = requests.delete(
            f"{API}/cinema/showtimes/{sid}",
            headers={"Authorization": f"Bearer {operator_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"delete failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("message") == "Showtime deleted", body
        assert body.get("deleted_count") == 1, body

        # GET details → 404
        r = requests.get(f"{API}/cinema/showtimes/{sid}/details", timeout=30)
        assert r.status_code == 404, f"details after delete: {r.status_code} {r.text[:300]}"

        # Missing from /cinemas/{id}/showtimes
        r = requests.get(
            f"{API}/cinema/{cinema_id}/showtimes",
            headers={"Authorization": f"Bearer {operator_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        rows = body if isinstance(body, list) else (body.get("showtimes") or body.get("items") or [])
        cinema_ids = {(s.get("id") or s.get("_id")) for s in rows}
        assert sid not in cinema_ids, "deleted showtime still present in /cinemas/{id}/showtimes"

        # Missing from /films/{film_id}/showtimes
        r = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", timeout=30)
        assert r.status_code == 200
        ids_after = {s["id"] for s in r.json().get("showtimes", [])}
        assert sid not in ids_after, "deleted showtime still present in /films/{id}/showtimes"

    def test_delete_refused_when_active_booking_exists(self, operator_token, operator_cinema):
        sid = _create_disposable_showtime(operator_token, operator_cinema)

        # Insert a synthetic active order referencing this showtime directly via
        # pymongo (the public booking endpoint requires seat-layout/seat-config
        # that the disposable screen may not have).
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("MONGO_DB_NAME") or os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME not available — cannot insert synthetic order")
        client = MongoClient(mongo_url)
        try:
            db = client[db_name]
            order_id = f"TEST_ITER168_{uuid.uuid4()}"
            db.orders.insert_one({
                "_id": order_id,
                "service_type": "cinema",
                "booking_details": {"showtime_id": sid},
                "status": "confirmed",
                "total_amount": 1.0,
            })

            r_del = requests.delete(
                f"{API}/cinema/showtimes/{sid}",
                headers={"Authorization": f"Bearer {operator_token}"},
                timeout=30,
            )
            assert r_del.status_code == 409, (
                f"expected 409 with active booking, got {r_del.status_code}: {r_del.text[:300]}"
            )
            body = r_del.json()
            detail = body.get("detail") or body.get("message") or ""
            assert "active booking" in detail.lower() or "replace" in detail.lower(), detail

            # Cleanup synthetic order, then verify hard-delete succeeds.
            db.orders.delete_one({"_id": order_id})
            r_del2 = requests.delete(
                f"{API}/cinema/showtimes/{sid}",
                headers={"Authorization": f"Bearer {operator_token}"},
                timeout=30,
            )
            assert r_del2.status_code == 200, f"delete after order cleanup: {r_del2.status_code} {r_del2.text[:200]}"
        finally:
            client.close()
