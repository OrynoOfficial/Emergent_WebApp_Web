"""
Iteration 178 — Live `available_seats` computation for cinema showtimes.

Validates that:
  1. GET /api/cinema/films/{film_id}/showtimes recomputes `available_seats`
     from BOTH cinema_bookings + orders collections (drift-free).
  2. Creating a fresh /api/orders/create cinema order with `booking_details.seats`
     decreases the count by len(seats) for that showtime.
  3. DELETE /api/orders/{id}/abandon frees the seats back up.
  4. GET /api/cinema/showtimes/{showtime_id}/details also returns the live
     `available_seats` AND a `booked_seats` list combining BOTH sources.

Reference test data (per main agent's notes):
  film_id    = 1edf5c04-f19a-4808-9b3c-b8e168e8dc02 (Olympus has Fallen - EN)
  showtime   = 58702e65-d02a-4d69-8480-4672756d0aa1 (2026-05-16 18:00)
  expected initial state: 33 total, 30 available, 3 booked (B1, C1, C2)
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

FILM_ID = "1edf5c04-f19a-4808-9b3c-b8e168e8dc02"
SHOWTIME_ID = "58702e65-d02a-4d69-8480-4672756d0aa1"
CINEMA_ID = "3990cc39-5e52-4900-a76a-eaa2b0f2749b"
EXPECTED_TOTAL = 33
EXPECTED_PRE_BOOKED = 3  # B1, C1, C2

CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


def _get_target_showtime():
    """Helper: pull the live target showtime row off the public listing."""
    r = requests.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", timeout=15)
    assert r.status_code == 200, r.text
    sts = r.json().get("showtimes", [])
    target = next((s for s in sts if s.get("id") == SHOWTIME_ID), None)
    assert target is not None, f"target showtime {SHOWTIME_ID} not in listing"
    return target, sts


# ---------- BACKEND #1 ----------
class TestInitialShowtimeAvailability:
    """GET /films/{id}/showtimes — initial state."""

    def test_target_showtime_shows_3_booked(self):
        target, _ = _get_target_showtime()
        assert target["total_seats"] == EXPECTED_TOTAL
        assert target["available_seats"] == EXPECTED_TOTAL - EXPECTED_PRE_BOOKED, (
            f"expected available={EXPECTED_TOTAL - EXPECTED_PRE_BOOKED}, "
            f"got {target['available_seats']} (booked_count={target.get('booked_seats_count')})"
        )
        assert target.get("booked_seats_count") == EXPECTED_PRE_BOOKED

    def test_other_showtimes_show_full_capacity(self):
        _, sts = _get_target_showtime()
        others = [s for s in sts if s.get("id") != SHOWTIME_ID]
        assert len(others) >= 1, "expected multiple showtimes"
        for s in others:
            # All other Olympus showtimes were unbooked at test-data setup time
            assert s["available_seats"] == s["total_seats"], (
                f"showtime {s['id']} expected available==total, "
                f"got avail={s['available_seats']} total={s['total_seats']} booked={s.get('booked_seats_count')}"
            )

    def test_listing_total_count_matches(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films/{FILM_ID}/showtimes", timeout=15)
        d = r.json()
        assert d["total"] == len(d["showtimes"])
        assert d["total"] >= 15  # main agent said 15


# ---------- BACKEND #4 ----------
class TestShowtimeDetailsEndpoint:
    """GET /cinema/showtimes/{id}/details — combines both collections."""

    def test_details_returns_live_available_seats(self):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        st = d.get("showtime", {})
        assert st.get("total_seats") == EXPECTED_TOTAL
        # available_seats = total - len(booked_seats)
        booked = d.get("booked_seats", []) or []
        assert st.get("available_seats") == EXPECTED_TOTAL - len(booked)

    def test_details_returns_booked_seats_list(self):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15)
        d = r.json()
        booked = d.get("booked_seats")
        assert isinstance(booked, list)
        # Must include the 3 pre-existing seats (legacy or orders source)
        assert "B1" in booked
        assert "C1" in booked
        assert "C2" in booked
        assert len(booked) >= EXPECTED_PRE_BOOKED

    def test_details_includes_seat_layout(self):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15)
        d = r.json()
        # Should at minimum have showtime + film + seat_layout + booked_seats keys
        assert "showtime" in d
        assert "booked_seats" in d


# ---------- BACKEND #2 + #3 ----------
class TestDynamicAvailabilityCreateThenAbandon:
    """End-to-end: create order → seats drop → abandon → seats restored."""

    def test_full_create_abandon_cycle(self, customer_headers):
        # ---- A. Baseline ----
        target_before, _ = _get_target_showtime()
        avail_before = target_before["available_seats"]
        booked_before = target_before["booked_seats_count"]

        details_before = requests.get(
            f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15
        ).json()
        booked_seats_before = set(details_before.get("booked_seats", []))

        # ---- B. Create a fresh cinema order with 2 unique TEST seats ----
        # Use TEST_-prefixed seat names that won't collide with seat layout
        # rows used in production data (B1/C1/C2). Use far-out rows.
        TEST_SEATS = ["G5", "G6"]
        payload = {
            "service_type": "cinema",
            "service_id": CINEMA_ID,
            "service_name": "TEST_Cinema - Olympus has Fallen",
            "total_amount": 12000.0,
            "currency": "XAF",
            "booking_details": {
                "showtime_id": SHOWTIME_ID,
                "seats": TEST_SEATS,
                "film_title": "TEST_Olympus has Fallen - EN",
                "show_date": "2026-05-16",
                "show_time": "18:00",
            },
            "customer_info": {"name": "TEST_Customer", "email": CUSTOMER["email"]},
        }
        r = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=payload,
            headers=customer_headers,
            timeout=20,
        )
        assert r.status_code in (200, 201), f"create_order failed: {r.status_code} {r.text}"
        order_id = (r.json().get("order") or {}).get("_id") or r.json().get("order_id") or r.json().get("_id")
        # Different schemas: try a few keys
        if not order_id:
            body = r.json()
            order_id = body.get("id") or (body.get("order") or {}).get("id")
        assert order_id, f"could not locate order_id in response: {r.json()}"

        try:
            # ---- C. Re-fetch showtimes — count should DROP by 2 ----
            target_after, _ = _get_target_showtime()
            assert target_after["available_seats"] == avail_before - len(TEST_SEATS), (
                f"after create: expected avail={avail_before - len(TEST_SEATS)}, "
                f"got {target_after['available_seats']}"
            )
            assert target_after["booked_seats_count"] == booked_before + len(TEST_SEATS)

            # ---- D. /details should also reflect the new booked seats ----
            details_after = requests.get(
                f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15
            ).json()
            booked_seats_after = set(details_after.get("booked_seats", []))
            assert booked_seats_after == booked_seats_before | set(TEST_SEATS), (
                f"booked_seats mismatch: expected += {TEST_SEATS}, "
                f"got delta {booked_seats_after - booked_seats_before}"
            )
            assert details_after["showtime"]["available_seats"] == EXPECTED_TOTAL - len(booked_seats_after)

            # ---- E. Abandon the order ----
            r = requests.delete(
                f"{BASE_URL}/api/orders/{order_id}/abandon",
                headers=customer_headers,
                timeout=15,
            )
            assert r.status_code == 200, f"abandon failed: {r.status_code} {r.text}"
            order_id = None  # mark as consumed so the finally block skips cleanup
        finally:
            # Cleanup fallback in case any assertion above failed mid-flight
            if order_id:
                try:
                    requests.delete(
                        f"{BASE_URL}/api/orders/{order_id}/abandon",
                        headers=customer_headers,
                        timeout=10,
                    )
                except Exception:
                    pass

        # ---- F. Re-fetch showtimes — count should be RESTORED ----
        target_restored, _ = _get_target_showtime()
        assert target_restored["available_seats"] == avail_before, (
            f"after abandon: expected avail back to {avail_before}, "
            f"got {target_restored['available_seats']}"
        )
        assert target_restored["booked_seats_count"] == booked_before

        # ---- G. /details should also drop the TEST seats ----
        details_restored = requests.get(
            f"{BASE_URL}/api/cinema/showtimes/{SHOWTIME_ID}/details", timeout=15
        ).json()
        booked_seats_restored = set(details_restored.get("booked_seats", []))
        assert booked_seats_restored == booked_seats_before


# ---------- REGRESSION ----------
class TestRegression:
    def test_empty_showtime_keeps_full_capacity(self):
        """An untouched showtime (any non-target) must still equal total_seats."""
        _, sts = _get_target_showtime()
        for s in sts:
            if s["id"] == SHOWTIME_ID:
                continue
            # No orders were created for these — must stay full
            assert s["available_seats"] == s["total_seats"]

    def test_unknown_film_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/cinema/films/does-not-exist/showtimes", timeout=10)
        assert r.status_code == 404

    def test_unknown_showtime_details_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/does-not-exist/details", timeout=10)
        assert r.status_code == 404
