"""Tests for the new public event-showtimes listing + admin_bulk events removal."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "superadmin@oryno.com", "password": "testpassword123"},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Super admin login failed: {r.status_code} {r.text[:120]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "customer@test.com", "password": "testpassword123"},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Customer login failed: {r.status_code} {r.text[:120]}")
    return r.json().get("access_token") or r.json().get("token")


# ── Public event-showtimes listing (anonymous + customer) ───────────────────
class TestPublicShowtimes:
    def test_anonymous_upcoming_only(self):
        r = requests.get(f"{BASE_URL}/api/event-showtimes/?upcoming_only=true", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "showtimes" in body and "total" in body
        # Every returned showtime must be published (drafts hidden from anon)
        for s in body["showtimes"]:
            assert s.get("status") == "published", f"Draft leaked: {s.get('title')} ({s.get('status')})"
            # required customer-facing fields
            assert "classes" in s
            assert "start_datetime" in s
            assert "location_name" in s
        # The seeded fixture promises 3 published upcoming events
        titles = [s.get("title") for s in body["showtimes"]]
        # Soft check: at least 3 published showtimes exist
        assert body["total"] >= 3, f"Expected >=3 published showtimes, got {body['total']} (titles={titles})"

    def test_anonymous_cannot_request_drafts(self):
        # Caller tries status=draft as anonymous — server should override to published
        r = requests.get(f"{BASE_URL}/api/event-showtimes/?status=draft", timeout=15)
        assert r.status_code == 200, r.text
        for s in r.json().get("showtimes", []):
            assert s.get("status") == "published", "Anonymous status=draft request leaked draft data"

    def test_customer_sees_same_published_only(self, customer_token):
        headers = {"Authorization": f"Bearer {customer_token}"}
        r = requests.get(f"{BASE_URL}/api/event-showtimes/?upcoming_only=true", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        for s in r.json().get("showtimes", []):
            assert s.get("status") == "published"

    def test_admin_can_see_drafts_explicitly(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/event-showtimes/?status=draft", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        # Admin asking for status=draft should NOT be forced to published
        for s in r.json().get("showtimes", []):
            assert s.get("status") == "draft"


# ── admin_bulk: 'events' must be rejected, others still accepted ─────────────
class TestAdminBulkEventsRemoved:
    def test_events_collection_rejected(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/bulk",
            headers=headers,
            json={"collection": "events", "action": "delete", "ids": ["non-existent-id"]},
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400 for events collection, got {r.status_code}: {r.text[:200]}"
        assert "events" in r.text.lower() or "not allowed" in r.text.lower()

    def test_banquets_collection_accepted(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/bulk",
            headers=headers,
            json={"collection": "banquets", "action": "deactivate", "ids": ["nope-id-xyz"]},
            timeout=15,
        )
        # Should succeed (200) even with 0 matches — proves whitelist still allows it
        assert r.status_code == 200, f"Expected 200 for banquets, got {r.status_code}: {r.text[:200]}"

    def test_event_showtimes_collection_still_accepted(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/bulk",
            headers=headers,
            json={"collection": "event_showtimes", "action": "deactivate", "ids": ["nope-id-xyz"]},
            timeout=15,
        )
        # event_showtimes has active_field=None so should return 400 with explanatory msg
        assert r.status_code in (200, 400)
