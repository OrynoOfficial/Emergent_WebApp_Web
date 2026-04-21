"""
Iter125 tests:
  (1) Settings timezone persistence via PUT /api/users/me/preferences and read-back through /api/auth/me
  (2) Travel Booking 'I am traveling' prefill — seed id_document_number on customer, ensure /auth/me returns it
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"no token in login response: {r.json()}"
    return token


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# --- (1) Settings: timezone preference persists ---
class TestTimezonePreference:
    def test_put_preferences_timezone_europe_paris(self, customer_token):
        r = requests.put(
            f"{BASE_URL}/api/users/me/preferences",
            json={"timezone": "Europe/Paris"},
            headers=_auth(customer_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # Read back via /auth/me
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=30)
        assert me.status_code == 200, me.text
        body = me.json()
        # timezone may be top-level or nested under preferences
        tz = body.get("timezone") or (body.get("preferences") or {}).get("timezone")
        assert tz == "Europe/Paris", f"expected Europe/Paris, got {tz}; body={body}"

    def test_put_preferences_timezone_africa_douala(self, customer_token):
        # Reset so subsequent tests are not surprised
        r = requests.put(
            f"{BASE_URL}/api/users/me/preferences",
            json={"timezone": "Africa/Douala"},
            headers=_auth(customer_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=30)
        tz = me.json().get("timezone") or (me.json().get("preferences") or {}).get("timezone")
        assert tz == "Africa/Douala"


# --- (2) Seed id_document_number on customer & verify /auth/me exposes it ---
class TestCustomerIdDocumentSeedAndMe:
    SEED_ID = "CM-ID-998877"

    def test_seed_id_document_number_via_put_users_me(self, customer_token):
        # Get current user id from /auth/me
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=30)
        assert me.status_code == 200, me.text
        user_id = me.json().get("id") or me.json().get("_id")
        assert user_id, f"no id in /auth/me: {me.json()}"

        # Self-update allowed for id_document_number
        r = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            json={"id_document_number": self.SEED_ID},
            headers=_auth(customer_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_auth_me_returns_id_document_number(self, customer_token):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=30)
        assert me.status_code == 200
        body = me.json()
        assert body.get("id_document_number") == self.SEED_ID, (
            f"expected {self.SEED_ID}, got {body.get('id_document_number')}"
        )

    def test_auth_me_has_prefill_fields(self, customer_token):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(customer_token), timeout=30)
        body = me.json()
        # Fields used by TravelBooking prefill
        for key in ("full_name",):
            assert key in body, f"/auth/me missing {key}"
        # phone may be optional but field should exist or be None
        # first_name/last_name may be absent in the model — prefill falls back to full_name split.
