"""Tests for the `min_available_seats` field added to GET /api/cinema/films.

That field powers the AlmostSoldOutBadge on the cinema results card. It must:
- be a non-negative integer when the film has upcoming showtimes
- reflect the LIVE minimum seats-left across upcoming showtimes
- be absent (or None) when the film has NO upcoming showtimes
"""
import os
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://cinema-management-p0.preview.emergentagent.com",
).rstrip("/")


@pytest.fixture(scope="module")
def all_films():
    r = requests.get(f"{BASE_URL}/api/cinema/films", timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("films", [])


def test_response_has_films(all_films):
    # We need at least one film to do meaningful assertions, but skip cleanly
    # in an empty DB so the test isn't flaky between environments.
    if not all_films:
        pytest.skip("No films seeded in this environment")
    assert isinstance(all_films, list)


def test_films_with_upcoming_showtimes_carry_min_available_seats(all_films):
    if not all_films:
        pytest.skip("No films seeded")
    # At least one film should carry the field if any film has upcoming showtimes.
    enriched = [f for f in all_films if f.get("min_available_seats") is not None]
    if not enriched:
        pytest.skip("No film in this environment has upcoming showtimes")
    for f in enriched:
        n = f["min_available_seats"]
        assert isinstance(n, int), f"min_available_seats must be an int, got {type(n)}"
        assert n >= 0, f"min_available_seats must be >= 0, got {n}"


def test_min_available_seats_matches_live_showtime_count(all_films):
    """For each enriched film, the surfaced min must equal the actual minimum
    `available_seats` returned by the per-film showtimes endpoint."""
    if not all_films:
        pytest.skip("No films seeded")
    checked = 0
    for f in all_films:
        if f.get("min_available_seats") is None:
            continue
        fid = f["id"]
        r = requests.get(f"{BASE_URL}/api/cinema/films/{fid}/showtimes", timeout=30)
        assert r.status_code == 200, r.text
        showtimes = r.json().get("showtimes", [])
        # Only upcoming showtimes are considered by the enrichment — but the
        # /films/{id}/showtimes endpoint returns all active ones. Filter to
        # those that share the same date semantics (>= today UTC) by simply
        # taking the minimum that exists in the response. If empty, skip.
        from datetime import datetime
        today = datetime.utcnow().date().isoformat()
        upcoming = [s for s in showtimes if (s.get("show_date") or "") >= today]
        if not upcoming:
            continue
        live_min = min(int(s.get("available_seats") or 0) for s in upcoming)
        assert f["min_available_seats"] == live_min, (
            f"Film {f.get('title')}: enrichment says {f['min_available_seats']} "
            f"but live min across upcoming showtimes is {live_min}"
        )
        checked += 1
    if checked == 0:
        pytest.skip("No film/showtime pair to verify in this environment")
