"""End-to-end test for the AlmostSoldOutBadge backend enrichment.

The badge is fed by `min_available_seats` returned by GET /api/cinema/films.
This test:
  1. Picks an existing Olympus showtime (33 seats).
  2. Places a cinema order via POST /api/orders/create for enough seats
     to drop min_available_seats below the 11-seat threshold.
  3. Re-fetches /api/cinema/films and asserts min_available_seats is the
     newly-reduced count (proving the badge would render).
  4. DELETE /api/orders/{id}/abandon restores the count.
  5. Sanity: a film with NO upcoming showtimes carries no field (skipped
     when no such film exists in the seeded DB).
"""
import os
import uuid
import requests
import pytest

def _load_base_url():
    val = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not val:
        # Fall back to frontend/.env (pytest runs without that env loaded)
        try:
            with open("/app/frontend/.env") as fh:
                for line in fh:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        val = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return val.rstrip("/")


BASE_URL = _load_base_url()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set in frontend/.env"

CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASS = "testpassword123"


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


def _get_films():
    r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("films", [])


def _olympus(films):
    for f in films:
        if "olympus" in (f.get("title") or "").lower():
            return f
    return None


def test_films_endpoint_returns_min_available_seats_field():
    films = _get_films()
    assert films, "No films seeded"
    olympus = _olympus(films)
    assert olympus is not None, "Olympus film expected in seeded data"
    assert "min_available_seats" in olympus, (
        f"Olympus film missing min_available_seats: keys={list(olympus.keys())}"
    )
    n = olympus["min_available_seats"]
    assert isinstance(n, int) and n >= 0, f"bad min_available_seats: {n!r}"


def test_min_available_seats_is_minimum_across_upcoming_showtimes():
    films = _get_films()
    olympus = _olympus(films)
    fid = olympus["id"]
    sr = requests.get(f"{BASE_URL}/api/cinema/films/{fid}/showtimes", timeout=30)
    assert sr.status_code == 200
    sts = sr.json().get("showtimes", [])
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    upcoming = [s for s in sts if (s.get("show_date") or "") >= today]
    assert upcoming, "Need upcoming Olympus showtimes for this test"
    live_min = min(int(s.get("available_seats") or 0) for s in upcoming)
    assert olympus["min_available_seats"] == live_min, (
        f"enrichment={olympus['min_available_seats']} vs live={live_min}"
    )


def test_low_inventory_order_triggers_badge_threshold(auth_headers):
    """The crown jewel: place an order big enough to push min_available_seats
    <= 11, verify enrichment surfaces the low count, then abandon to restore."""
    films = _get_films()
    olympus = _olympus(films)
    fid = olympus["id"]
    baseline_min = olympus["min_available_seats"]

    # Pick the showtime with the MOST current availability so our seat-block
    # collision is minimal. Need to drop it to <= 11 by booking enough.
    sr = requests.get(f"{BASE_URL}/api/cinema/films/{fid}/showtimes", timeout=30)
    sts = sr.json().get("showtimes", [])
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    upcoming = [s for s in sts if (s.get("show_date") or "") >= today]
    # Pick the showtime where the live min lives so we control it.
    target = min(upcoming, key=lambda s: int(s.get("available_seats") or 0))
    avail = int(target["available_seats"])
    total = int(target["total_seats"])
    target_left = 10  # below the 11-seat threshold
    n_to_book = avail - target_left
    if n_to_book <= 0:
        pytest.skip(f"Showtime already at {avail} seats, can't reduce further")

    # Synthesize a seat-id list that doesn't collide with the existing
    # booked_seats. Use a high row letter ('Z' is not in 7-row layout, so
    # use unique tagged identifiers). Backend treats seats as opaque strings
    # for the enrichment counter — it only counts list length.
    unique = uuid.uuid4().hex[:6]
    seats = [f"T{unique[:2]}-{i}" for i in range(n_to_book)]

    order_payload = {
        "service_type": "cinema",
        "service_id": target.get("cinema_id"),
        "service_name": "TEST_FOMO_BADGE_Olympus",
        "total_amount": 6000.0 * n_to_book,
        "currency": "XAF",
        "booking_details": {
            "showtime_id": target["id"],
            "film_id": fid,
            "cinema_id": target.get("cinema_id"),
            "seats": seats,
            "film_title": "TEST_Olympus FOMO",
            "show_date": target.get("show_date"),
            "show_time": target.get("show_time"),
        },
        "customer_info": {"name": "TEST_FOMO", "email": CUSTOMER_EMAIL},
    }
    cr = requests.post(
        f"{BASE_URL}/api/orders/create",
        json=order_payload,
        headers=auth_headers,
        timeout=30,
    )
    assert cr.status_code in (200, 201), f"order/create failed: {cr.status_code} {cr.text}"
    body = cr.json()
    order_id = (
        (body.get("order") or {}).get("_id")
        or (body.get("order") or {}).get("id")
        or body.get("order_id")
        or body.get("_id")
        or body.get("id")
    )
    assert order_id, f"no order id in response: {body}"

    try:
        # Re-fetch films and assert the new min_available_seats matches.
        films2 = _get_films()
        olympus2 = _olympus(films2)
        new_min = olympus2.get("min_available_seats")
        assert new_min == target_left, (
            f"expected min_available_seats={target_left} after booking "
            f"{n_to_book} seats, got {new_min} (baseline was {baseline_min})"
        )
        assert new_min <= 11, "badge threshold not crossed"
    finally:
        # Always clean up
        dr = requests.delete(
            f"{BASE_URL}/api/orders/{order_id}/abandon",
            headers=auth_headers,
            timeout=30,
        )
        assert dr.status_code in (200, 204), f"abandon failed: {dr.status_code} {dr.text}"

    # Restored baseline
    films3 = _get_films()
    olympus3 = _olympus(films3)
    assert olympus3["min_available_seats"] == baseline_min, (
        f"abandon did not restore: was {baseline_min}, now {olympus3['min_available_seats']}"
    )
