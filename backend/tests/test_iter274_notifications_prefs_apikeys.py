"""
Iteration 274 - Comprehensive backend tests for:
  1. Notification gate enforcement (should_notify)
  2. User preferences persistence
  3. Session timeout enforcement (JWT exp matches config)
  4. API Keys audit (mask + validate + admin gating)
"""
import base64
import json
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = ("customer@test.com", "testpassword123")
ADMIN = ("admin@test.com", "testpassword123")
OPERATOR = ("operator@test.com", "testpassword123")
# Per /app/memory/test_credentials.md the super admin email is superadmin@oryno.com
SUPER_ADMIN = ("superadmin@oryno.com", "testpassword123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access_token") or data.get("token"), data


@pytest.fixture(scope="module")
def customer_token():
    tok, _ = _login(*CUSTOMER)
    return tok


@pytest.fixture(scope="module")
def admin_token():
    tok, _ = _login(*ADMIN)
    return tok


@pytest.fixture(scope="module")
def operator_token():
    tok, _ = _login(*OPERATOR)
    return tok


@pytest.fixture(scope="module")
def super_admin_token():
    try:
        tok, _ = _login(*SUPER_ADMIN)
        return tok
    except AssertionError:
        # Fallback: try superadmin@test.com if oryno doesn't work
        try:
            tok, _ = _login("superadmin@test.com", "testpassword123")
            return tok
        except AssertionError:
            pytest.skip("Super admin login failed for both known emails")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------------------- 1. NOTIFICATION GATE --------------------
class TestNotificationGate:
    def test_toggle_off_and_gate_returns_false(self, customer_token):
        # Snapshot original prefs
        r0 = requests.get(f"{API}/users/me/notifications", headers=_h(customer_token), timeout=15)
        assert r0.status_code == 200, r0.text
        original = r0.json()

        # Turn off email + booking_updates
        r1 = requests.put(
            f"{API}/users/me/notifications",
            headers=_h(customer_token),
            json={"email_notifications": False, "booking_updates": False, "push_notifications": False},
            timeout=15,
        )
        assert r1.status_code == 200, r1.text

        # Verify persistence via GET
        r2 = requests.get(f"{API}/users/me/notifications", headers=_h(customer_token), timeout=15)
        d = r2.json()
        assert d["email_notifications"] is False
        assert d["booking_updates"] is False
        assert d["push_notifications"] is False

        # Now test should_notify via a subprocess of python that imports it
        import subprocess
        # Find the customer's user_id from /me
        me = requests.get(f"{API}/auth/me", headers=_h(customer_token), timeout=15).json()
        uid = me.get("id") or me.get("_id")
        assert uid, f"Could not get user id: {me}"

        script = f"""
import asyncio, sys, os
sys.path.insert(0, '/app/backend')
from config.database import connect_to_mongo
from utils.notification_gate import should_notify

async def run():
    await connect_to_mongo()
    email_booking = await should_notify('{uid}', 'email', 'booking')
    push_booking = await should_notify('{uid}', 'push', 'booking')
    email_txn = await should_notify('{uid}', 'email', 'transactional')
    push_txn = await should_notify('{uid}', 'push', 'transactional')
    print(f'email_booking={{email_booking}} push_booking={{push_booking}} email_txn={{email_txn}} push_txn={{push_txn}}')

asyncio.run(run())
"""
        proc = subprocess.run(["python", "-c", script], capture_output=True, text=True, cwd="/app/backend", timeout=30)
        print("STDOUT:", proc.stdout, "STDERR:", proc.stderr)
        assert proc.returncode == 0, proc.stderr
        out = proc.stdout
        assert "email_booking=False" in out
        assert "push_booking=False" in out
        assert "email_txn=True" in out
        assert "push_txn=True" in out

        # Restore prefs
        restore = {k: original.get(k, True) for k in ["email_notifications", "sms_notifications", "push_notifications", "booking_updates", "promotional", "newsletter"]}
        r3 = requests.put(f"{API}/users/me/notifications", headers=_h(customer_token), json=restore, timeout=15)
        assert r3.status_code == 200


# -------------------- 2. PREFERENCES --------------------
class TestPreferences:
    def test_get_and_update_preferences(self, customer_token):
        r = requests.get(f"{API}/users/me/preferences", headers=_h(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ["language", "currency", "timezone", "theme",
                    "date_format", "time_format", "distance_unit", "font_scale"]:
            assert key in d, f"Missing preference key: {key}"

        # Update to dark + EUR
        r1 = requests.put(f"{API}/users/me/preferences",
                          headers=_h(customer_token),
                          json={"theme": "dark", "currency": "EUR"}, timeout=15)
        assert r1.status_code == 200, r1.text

        r2 = requests.get(f"{API}/users/me/preferences", headers=_h(customer_token), timeout=15).json()
        assert r2["theme"] == "dark"
        assert r2["currency"] == "EUR"

        # Reset
        r3 = requests.put(f"{API}/users/me/preferences",
                          headers=_h(customer_token),
                          json={"theme": d.get("theme", "light"), "currency": d.get("currency", "XAF")}, timeout=15)
        assert r3.status_code == 200


# -------------------- 3. SESSION TIMEOUT --------------------
def _decode_jwt_payload(token):
    parts = token.split(".")
    assert len(parts) == 3, "Not a JWT"
    payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))


class TestSessionTimeout:
    def test_public_endpoint_shape(self):
        r = requests.get(f"{API}/system-settings/public/session-timeout", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_timeout_minutes" in d
        # Per code, keys are min_session_timeout and max_session_timeout
        assert "min_session_timeout" in d or "min" in d
        assert "max_session_timeout" in d or "max" in d

    def test_super_admin_can_update_and_token_exp_matches(self, super_admin_token):
        # Set to 20 minutes
        r = requests.put(f"{API}/system-settings/session-timeout",
                         headers=_h(super_admin_token),
                         json={"session_timeout_minutes": 20}, timeout=15)
        assert r.status_code == 200, r.text

        try:
            # Now login as customer and check exp
            tok, _ = _login(*CUSTOMER)
            payload = _decode_jwt_payload(tok)
            exp = payload.get("exp")
            assert exp, f"No exp in JWT payload: {payload}"
            now = time.time()
            delta = exp - now
            # Expect ~20 minutes = 1200s ±60s
            assert 1140 <= delta <= 1260, f"Expected exp ~1200s, got {delta}s"
        finally:
            # Reset to 30
            requests.put(f"{API}/system-settings/session-timeout",
                         headers=_h(super_admin_token),
                         json={"session_timeout_minutes": 30}, timeout=15)


# -------------------- 4. API KEYS AUDIT --------------------
class TestApiKeys:
    def test_admin_can_list_masked_keys(self, admin_token):
        r = requests.get(f"{API}/admin/api-keys/", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "keys" in d
        providers = {k["provider"] for k in d["keys"]}
        for expected in ["Stripe", "Resend", "Infobip", "Emergent Integrations", "MTN MoMo"]:
            assert expected in providers, f"Missing provider {expected}"
        # Verify masked never contains full key material
        for k in d["keys"]:
            if k["is_set"]:
                assert "****" in k["masked"], f"Key not masked: {k}"
                assert len(k["masked"]) <= 20, f"Masked too long: {k['masked']}"

    def test_operator_denied(self, operator_token):
        r = requests.get(f"{API}/admin/api-keys/", headers=_h(operator_token), timeout=15)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_validate_stripe_returns_status_and_message(self, admin_token):
        r = requests.post(f"{API}/admin/api-keys/Stripe/validate", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") in ("ok", "invalid", "error"), f"Bad status: {d}"
        assert "message" in d
        assert d.get("provider") == "Stripe"
