"""
Iteration 238 — Events seed verification + Bulk endpoint whitelist additions.

Coverage:
  1) GET /api/events/?limit=10 returns >= 3 events with proper shape:
     - start_date >= today (YYYY-MM-DD ISO)
     - ticket_types is a non-empty array with numeric `price`
     - event_type ∈ {festival, conference, party}
  2) The newly-whitelisted bulk collections (banquets, pressings, package_services)
     are reachable for action='deactivate' / 'activate' as superadmin and rejected
     for the customer (403). Uses empty `ids` so this is a no-op write — safe and
     does NOT touch real seeded data.
"""
import os
from datetime import date

import requests

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
_tok: dict[str, str] = {}


def _login(email, pwd):
    if email in _tok:
        return _tok[email]
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pwd})
    t = r.json().get("access_token")
    if t:
        _tok[email] = t
    return t


def _super_headers():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer_headers():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


# ---------- Events seed regression ----------

def test_events_endpoint_returns_seeded_events():
    """The seed script must surface >= 3 future-dated events with the new shape."""
    r = requests.get(f"{API}/api/events/?limit=10")
    assert r.status_code == 200, r.text
    data = r.json()
    # API may return either a list or {events: [...]} — handle both.
    events = data if isinstance(data, list) else data.get("events", [])
    assert len(events) >= 3, f"Expected ≥3 events, got {len(events)}: {events}"

    today = date.today().isoformat()
    allowed_types = {"festival", "conference", "party"}
    for ev in events[:3]:
        # start_date present and >= today
        sd = ev.get("start_date")
        assert sd is not None, f"Missing start_date in event {ev.get('name')}"
        assert sd >= today, f"start_date {sd} is in the past for {ev.get('name')}"
        # ticket_types validation
        tts = ev.get("ticket_types") or []
        assert isinstance(tts, list) and len(tts) > 0, (
            f"ticket_types must be a non-empty list for {ev.get('name')}"
        )
        for tt in tts:
            assert isinstance(tt.get("price"), (int, float)), (
                f"ticket_types[*].price must be numeric ({tt})"
            )
        # event_type allowed
        assert ev.get("event_type") in allowed_types, (
            f"event_type {ev.get('event_type')} not in {allowed_types}"
        )


# ---------- Bulk whitelist regression ----------

_NONEXISTENT_ID = "iter238-nonexistent-id-aaaa-bbbb-cccc-dddddddddddd"


def test_bulk_allows_banquets_collection_superadmin():
    """Whitelisted: must NOT 400 with 'unknown collection'. Bogus id → 0 modified."""
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "banquets", "action": "deactivate", "ids": [_NONEXISTENT_ID]},
        headers=_super_headers(),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("modified", 0) == 0


def test_bulk_allows_pressings_collection_superadmin():
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "pressings", "action": "activate", "ids": [_NONEXISTENT_ID]},
        headers=_super_headers(),
    )
    assert r.status_code == 200, r.text
    assert r.json().get("modified", 0) == 0


def test_bulk_allows_package_services_collection_superadmin():
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "package_services", "action": "deactivate", "ids": [_NONEXISTENT_ID]},
        headers=_super_headers(),
    )
    assert r.status_code == 200, r.text
    assert r.json().get("modified", 0) == 0


def test_bulk_new_collections_still_forbidden_for_customer():
    for coll in ("banquets", "pressings", "package_services"):
        r = requests.post(
            f"{API}/api/admin/bulk",
            json={"collection": coll, "action": "deactivate", "ids": [_NONEXISTENT_ID]},
            headers=_customer_headers(),
        )
        assert r.status_code == 403, f"{coll}: expected 403, got {r.status_code} - {r.text}"
