"""
Backend tests for the Operator owner email-verification invite flow (iter 161).
Covers:
  - POST /api/operators/ with create_owner_account=true -> pending_verification + invite_link
  - GET /api/auth/verify-account/{token} (404 invalid, 200 valid)
  - POST /api/auth/verify-account (400 missing pw when needs pw, success path)
  - Login blocked while pending_verification (403), succeeds after verify
  - POST /api/auth/resend-invite/{user_id} (admin only; invalidates prior token)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
SUPERADMIN_EMAIL = "superadmin@oryno.com"
SUPERADMIN_PASS = "testpassword123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASS},
                      timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _unique_suffix():
    return uuid.uuid4().hex[:10]


def _make_operator_payload(suffix, *, with_password=False, perms=None):
    return {
        "name": f"TEST_Op_{suffix}",
        "operator_type": "hotel",
        "service_types": ["hotel"],
        "email": f"op_{suffix}@example.com",
        "phone": "+237699000000",
        "city": "Douala",
        "country": "CM",
        "market_segment": "sme",
        "create_owner_account": True,
        "owner_full_name": f"Owner {suffix}",
        "owner_email": f"owner_{suffix}@example.com",
        "owner_password": "starterpass123" if with_password else None,
        "owner_permissions": perms or ["bookings.view", "services.view"],
    }


# ───────────── Create operator with owner account (no password = invitee sets it) ─────────────
class TestCreateOperatorOwner:
    def test_create_owner_no_password_returns_invite_link(self, auth_headers):
        suf = _unique_suffix()
        payload = _make_operator_payload(suf, with_password=False)
        r = requests.post(f"{BASE_URL}/api/operators/", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["owner_account_created"] is True
        assert data["owner_email"] == payload["owner_email"]
        assert "invite_link" in data and data["invite_link"], "invite_link must be present"
        assert "/verify-account?token=" in data["invite_link"]
        assert data.get("invite_email_status") in ("sent", "failed")
        # No password echo when admin didn't set one
        assert "default_password" not in data
        # Persist for downstream cross-test usage
        TestCreateOperatorOwner.no_pw = {
            "invite_link": data["invite_link"],
            "token": data["invite_link"].split("token=")[-1],
            "owner_user_id": data["owner_user_id"],
            "owner_email": data["owner_email"],
        }

    def test_create_owner_with_password_echoes_default(self, auth_headers):
        suf = _unique_suffix()
        payload = _make_operator_payload(suf, with_password=True)
        r = requests.post(f"{BASE_URL}/api/operators/", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["owner_account_created"] is True
        assert data.get("default_password") == "starterpass123"
        assert data["invite_link"].endswith("token=" + data["invite_link"].split("token=")[-1])
        TestCreateOperatorOwner.with_pw = {
            "invite_link": data["invite_link"],
            "token": data["invite_link"].split("token=")[-1],
            "owner_user_id": data["owner_user_id"],
            "owner_email": data["owner_email"],
        }

    def test_login_blocked_while_pending(self, auth_headers):
        owner = TestCreateOperatorOwner.with_pw
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": owner["owner_email"], "password": "starterpass123"},
                          timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert "confirm" in r.json().get("detail", "").lower()


# ───────────── Token info & verification (GET + POST /auth/verify-account) ─────────────
class TestVerifyAccount:
    def test_get_token_info_404_for_unknown(self):
        r = requests.get(f"{BASE_URL}/api/auth/verify-account/{uuid.uuid4().hex}", timeout=30)
        assert r.status_code == 404

    def test_get_token_info_for_valid_no_pw(self):
        tok = TestCreateOperatorOwner.no_pw["token"]
        r = requests.get(f"{BASE_URL}/api/auth/verify-account/{tok}", timeout=30)
        assert r.status_code == 200, r.text
        info = r.json()
        assert info["email"] == TestCreateOperatorOwner.no_pw["owner_email"]
        assert info["has_temp_password"] is False
        assert "operator_name" in info
        assert "expires_at" in info

    def test_verify_no_pw_requires_password(self):
        tok = TestCreateOperatorOwner.no_pw["token"]
        # Missing password
        r = requests.post(f"{BASE_URL}/api/auth/verify-account", json={"token": tok}, timeout=30)
        assert r.status_code == 400, r.text
        # Too short
        r2 = requests.post(f"{BASE_URL}/api/auth/verify-account", json={"token": tok, "password": "short"}, timeout=30)
        assert r2.status_code == 400

    def test_verify_no_pw_success_then_login_works(self):
        tok = TestCreateOperatorOwner.no_pw["token"]
        new_pw = "MyNewPass!2026"
        r = requests.post(f"{BASE_URL}/api/auth/verify-account",
                          json={"token": tok, "password": new_pw}, timeout=30)
        assert r.status_code == 200, r.text
        # Reuse of consumed token -> 410
        r2 = requests.post(f"{BASE_URL}/api/auth/verify-account",
                           json={"token": tok, "password": new_pw}, timeout=30)
        assert r2.status_code == 410
        # GET also returns 410 for consumed token
        r3 = requests.get(f"{BASE_URL}/api/auth/verify-account/{tok}", timeout=30)
        assert r3.status_code == 410
        # Login works with new password
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": TestCreateOperatorOwner.no_pw["owner_email"],
                                    "password": new_pw}, timeout=30)
        assert login.status_code == 200, login.text
        assert "access_token" in login.json()

    def test_verify_with_temp_pw_no_password_field(self):
        """When has_temp_password=True, password is optional — calling verify w/o pw should succeed."""
        tok = TestCreateOperatorOwner.with_pw["token"]
        # Token info reports has_temp_password=True
        info = requests.get(f"{BASE_URL}/api/auth/verify-account/{tok}", timeout=30).json()
        assert info["has_temp_password"] is True
        r = requests.post(f"{BASE_URL}/api/auth/verify-account", json={"token": tok}, timeout=30)
        assert r.status_code == 200, r.text
        # Login with original starter password works
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": TestCreateOperatorOwner.with_pw["owner_email"],
                                    "password": "starterpass123"}, timeout=30)
        assert login.status_code == 200, login.text


# ───────────── Resend invite ─────────────
class TestResendInvite:
    def test_resend_for_pending_user(self, auth_headers):
        # Create a fresh pending operator owner
        suf = _unique_suffix()
        payload = _make_operator_payload(suf, with_password=True)
        r = requests.post(f"{BASE_URL}/api/operators/", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201)
        d = r.json()
        owner_id = d["owner_user_id"]
        original_token = d["invite_link"].split("token=")[-1]

        # Resend
        r2 = requests.post(f"{BASE_URL}/api/auth/resend-invite/{owner_id}",
                           headers=auth_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "invite_link" in data and data["invite_link"]
        new_token = data["invite_link"].split("token=")[-1]
        assert new_token != original_token, "Resend should produce a fresh token"
        assert data.get("email_status") in ("sent", "failed")

        # Old token should now be invalidated (consumed/revoked -> 410)
        r3 = requests.get(f"{BASE_URL}/api/auth/verify-account/{original_token}", timeout=30)
        assert r3.status_code in (410, 404), f"old token expected 410/404, got {r3.status_code}"
        # New token still valid (200)
        r4 = requests.get(f"{BASE_URL}/api/auth/verify-account/{new_token}", timeout=30)
        assert r4.status_code == 200

    def test_resend_requires_admin(self):
        # Login as a customer
        cust = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": "customer@test.com", "password": "testpassword123"},
                             timeout=30)
        if cust.status_code != 200:
            pytest.skip("customer account not available")
        tok = cust.json()["access_token"]
        r = requests.post(f"{BASE_URL}/api/auth/resend-invite/{uuid.uuid4().hex}",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code == 403

    def test_resend_for_unknown_user(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/auth/resend-invite/{uuid.uuid4().hex}",
                          headers=auth_headers, timeout=30)
        assert r.status_code == 404


# ───────────── Duplicate email guard ─────────────
class TestDuplicateGuard:
    def test_duplicate_owner_email_rejected(self, auth_headers):
        suf = _unique_suffix()
        payload = _make_operator_payload(suf, with_password=True)
        r = requests.post(f"{BASE_URL}/api/operators/", headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201)
        # Re-use same owner email
        payload2 = _make_operator_payload(_unique_suffix(), with_password=True)
        payload2["owner_email"] = payload["owner_email"]
        r2 = requests.post(f"{BASE_URL}/api/operators/", headers=auth_headers, json=payload2, timeout=30)
        assert r2.status_code == 400
        assert "already exists" in r2.json().get("detail", "").lower()
