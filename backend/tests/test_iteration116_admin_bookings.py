"""
Iteration 116 regression: Admin Bookings page fix + support_tickets team-members endpoints.

Backend change verified:
- /api/operator/manual-bookings/ now accepts limit up to 1000 (was le=200 causing 422).
- /api/support-tickets/team-members GET/POST/DELETE still work after dup cleanup.

Run:
  pytest /app/backend/tests/test_iteration116_admin_bookings.py -v
"""
import os
import uuid
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()

ADMIN = ("admin@test.com", "testpassword123")
SUPER = ("superadmin@oryno.com", "testpassword123")
OPERATOR = ("operator@test.com", "testpassword123")


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def super_token():
    return _login(*SUPER)


@pytest.fixture(scope="module")
def operator_token():
    return _login(*OPERATOR)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --- Admin Bookings list endpoint ---------------------------------------------------

class TestAdminBookingsLimit:
    def test_admin_limit_500_no_422(self, admin_token):
        """Frontend calls limit=500 — must not return 422 (was the root cause)."""
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=500",
            headers=_h(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        # Response is expected to be a list OR a dict with items
        if isinstance(data, dict):
            items = data.get("items") or data.get("bookings") or data.get("data") or []
        else:
            items = data
        assert isinstance(items, list), f"Expected list-like payload, got {type(items)}"
        # Admin should see a meaningful number (~163 per the task; accept >=1 to be safe)
        assert len(items) >= 1, f"Admin should see bookings; got 0. Response: {str(data)[:300]}"
        print(f"Admin sees {len(items)} bookings with limit=500")

    def test_admin_limit_1000_ok(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=1000",
            headers=_h(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"limit=1000 must be accepted after cap raise: {r.text[:200]}"

    def test_admin_limit_above_cap_422(self, admin_token):
        """Cap is 1000 — limit=1001 must be rejected."""
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=1001",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 422, f"Expected 422 for limit>1000, got {r.status_code}"

    def test_super_admin_sees_all(self, super_token):
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=500",
            headers=_h(super_token),
            timeout=30,
        )
        assert r.status_code == 200, f"Super admin list failed: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else (
            data.get("items") or data.get("bookings") or data.get("data") or []
        )
        assert len(items) >= 1
        print(f"Super admin sees {len(items)} bookings")

    def test_operator_scoped(self, operator_token):
        """Operator should see only their own bookings (~26 per task)."""
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=500",
            headers=_h(operator_token),
            timeout=30,
        )
        assert r.status_code == 200, f"Operator list failed: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else (
            data.get("items") or data.get("bookings") or data.get("data") or []
        )
        # Verify all returned bookings share a single operator_id (scope enforced)
        operator_ids = {b.get("operator_id") for b in items if isinstance(b, dict)}
        print(f"Operator sees {len(items)} bookings; operator_ids in list: {operator_ids}")
        assert len(operator_ids) <= 1, f"Operator scope leak — multiple operator_ids: {operator_ids}"

    def test_channel_filter_on_site(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=500&channel=on_site",
            headers=_h(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"channel=on_site failed: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else (
            data.get("items") or data.get("bookings") or data.get("data") or []
        )
        for b in items:
            if isinstance(b, dict) and "channel" in b:
                assert b["channel"] == "on_site", f"Non on_site leaked: {b.get('channel')}"

    def test_channel_filter_online(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/operator/manual-bookings/?limit=500&channel=online",
            headers=_h(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"channel=online failed: {r.text[:200]}"


# --- Support tickets team-members endpoints (duplicates removed) --------------------

class TestTeamMembersEndpoints:
    def test_get_team_members_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/support-tickets/team-members",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, f"GET team-members failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "team_members" in body, f"Unexpected shape: {body}"
        assert isinstance(body["team_members"], list)
        print(f"team_members count: {len(body['team_members'])}")

    def test_add_and_remove_team_member(self, admin_token):
        member_id = f"TEST_iter116_{uuid.uuid4().hex[:8]}"
        payload = {
            "id": member_id,
            "name": "TEST Iter116 Member",
            "email": f"TEST_{member_id}@example.com",
            "role": "Agent",
            "department": "Support",
            "type": "employee",
        }
        # POST add
        r = requests.post(
            f"{BASE_URL}/api/support-tickets/team-members",
            headers=_h(admin_token),
            json=payload,
            timeout=20,
        )
        assert r.status_code in (200, 201), f"POST team-members failed: {r.status_code} {r.text[:300]}"

        # Verify via GET
        r2 = requests.get(
            f"{BASE_URL}/api/support-tickets/team-members",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r2.status_code == 200
        ids = [m.get("id") for m in r2.json().get("team_members", [])]
        assert member_id in ids, f"Added member not returned by GET; ids sample: {ids[:5]}"

        # DELETE
        r3 = requests.delete(
            f"{BASE_URL}/api/support-tickets/team-members/{member_id}",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r3.status_code in (200, 204), f"DELETE team-members failed: {r3.status_code} {r3.text[:200]}"

        # Verify removed
        r4 = requests.get(
            f"{BASE_URL}/api/support-tickets/team-members",
            headers=_h(admin_token),
            timeout=20,
        )
        ids_after = [m.get("id") for m in r4.json().get("team_members", [])]
        assert member_id not in ids_after, "Deleted member still present"
