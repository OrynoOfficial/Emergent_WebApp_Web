"""
Event Showtime `poster_url` round-trip — create, read, and edit the dedicated
hero poster image used on the customer booking page. Falls back to images[0]
when not set so legacy showtimes keep working.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import requests

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
_tok_cache: dict[str, str] = {}


def _login(email, pwd):
    if email in _tok_cache:
        return _tok_cache[email]
    t = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pwd}).json().get("access_token")
    if t:
        _tok_cache[email] = t
    return t


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _future_iso(days=14):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")


def _new_location():
    return requests.post(
        f"{API}/api/event-locations/",
        json={
            "name": f"Poster Venue {uuid.uuid4().hex[:6]}",
            "city": "Douala",
            "address": "Poster Ave",
            "layout_type": "simple",
            "capacity": 50,
            "operator_id": OP_ID,
        },
        headers=_super(),
    ).json()["id"]


def test_poster_url_persists_on_create():
    loc_id = _new_location()
    sid = requests.post(
        f"{API}/api/event-showtimes/",
        json={
            "location_id": loc_id,
            "title": "Poster Test Show",
            "start_datetime": _future_iso(),
            "end_datetime": _future_iso(),
            "poster_url": "https://example.com/poster-A.png",
            "classes": [{"name": "GA", "price": 5000, "total_units": 10}],
            "operator_id": OP_ID,
            "status": "published",
        },
        headers=_super(),
    ).json()["id"]
    body = requests.get(f"{API}/api/event-showtimes/{sid}").json()
    assert body["poster_url"] == "https://example.com/poster-A.png"


def test_poster_url_updates_via_put():
    loc_id = _new_location()
    sid = requests.post(
        f"{API}/api/event-showtimes/",
        json={
            "location_id": loc_id,
            "title": "Poster Update Show",
            "start_datetime": _future_iso(),
            "end_datetime": _future_iso(),
            "poster_url": "https://example.com/original.png",
            "classes": [{"name": "GA", "price": 5000, "total_units": 10}],
            "operator_id": OP_ID,
        },
        headers=_super(),
    ).json()["id"]

    requests.put(
        f"{API}/api/event-showtimes/{sid}",
        json={"poster_url": "https://example.com/updated.png"},
        headers=_super(),
    )
    body = requests.get(f"{API}/api/event-showtimes/{sid}").json()
    assert body["poster_url"] == "https://example.com/updated.png"


def test_poster_url_optional_no_breakage():
    """A showtime without poster_url should still work — images[0] is the fallback."""
    loc_id = _new_location()
    sid = requests.post(
        f"{API}/api/event-showtimes/",
        json={
            "location_id": loc_id,
            "title": "No Poster Show",
            "start_datetime": _future_iso(),
            "end_datetime": _future_iso(),
            "images": ["https://example.com/gallery-1.png", "https://example.com/gallery-2.png"],
            "classes": [{"name": "GA", "price": 5000, "total_units": 10}],
            "operator_id": OP_ID,
        },
        headers=_super(),
    ).json()["id"]
    body = requests.get(f"{API}/api/event-showtimes/{sid}").json()
    assert body.get("poster_url") in (None, "")
    assert body["images"][0] == "https://example.com/gallery-1.png"
