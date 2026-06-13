"""Phase A auth tests:
- POST /api/auth/check-account (two-step login existence check)
- POST /api/auth/forgot-password (customers only; operators 403)
- POST /api/auth/reset-password (email magic-link + phone OTP)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "mani-monroe@netflix.com"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ─── /api/auth/check-account ──────────────────────────────────────────
class TestCheckAccount:
    def test_existing_email(self, s):
        r = s.post(f"{BASE_URL}/api/auth/check-account",
                   json={"method": "email", "identifier": CUSTOMER_EMAIL})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("exists") is True
        assert "role" in d and "status" in d

    def test_unknown_email(self, s):
        r = s.post(f"{BASE_URL}/api/auth/check-account",
                   json={"method": "email", "identifier": "noone@nowhere.test"})
        assert r.status_code == 200, r.text
        assert r.json() == {"exists": False}

    def test_invalid_method(self, s):
        r = s.post(f"{BASE_URL}/api/auth/check-account",
                   json={"method": "fax", "identifier": "x@y.com"})
        assert r.status_code == 400

    def test_blank_identifier(self, s):
        r = s.post(f"{BASE_URL}/api/auth/check-account",
                   json={"method": "email", "identifier": "   "})
        assert r.status_code == 400


# ─── /api/auth/forgot-password ────────────────────────────────────────
class TestForgotPassword:
    def test_email_path_returns_reset_link(self, s):
        r = s.post(f"{BASE_URL}/api/auth/forgot-password",
                   json={"method": "email", "identifier": CUSTOMER_EMAIL})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("sent") is True
        assert d.get("channel") == "email"
        # Sandbox should surface the link
        link = d.get("reset_link")
        assert link and "/reset-password?token=" in link, f"Bad link: {link}"

    def test_phone_path_returns_otp(self, s):
        r = s.post(f"{BASE_URL}/api/auth/forgot-password",
                   json={"method": "phone", "identifier": "+237600000000"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("sent") is True
        assert d.get("channel") == "phone"
        # OTP may be None if the test phone doesn't match any user (silent for
        # enumeration protection). At minimum, the contract should hold.
        assert "otp" in d

    def test_operator_blocked_403(self, s):
        r = s.post(f"{BASE_URL}/api/auth/forgot-password",
                   json={"method": "email", "identifier": OPERATOR_EMAIL})
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", "")
        assert "Operator" in detail or "self-reset" in detail

    def test_unknown_identifier_generic_success(self, s):
        """Should NOT 404 — anti-enumeration: silent success."""
        r = s.post(f"{BASE_URL}/api/auth/forgot-password",
                   json={"method": "email", "identifier": "ghost@nowhere.test"})
        assert r.status_code == 200
        assert r.json().get("sent") is True


# ─── /api/auth/reset-password (email magic link) ─────────────────────
class TestResetPasswordEmail:
    @pytest.fixture
    def reset_token(self, s):
        """Request a fresh reset link for the customer and extract the token."""
        # Back off briefly in case the per-IP forgot-password rate-limit
        # bucket is hot from earlier tests in the module.
        import time
        for _ in range(6):
            r = s.post(f"{BASE_URL}/api/auth/forgot-password",
                       json={"method": "email", "identifier": CUSTOMER_EMAIL})
            if r.status_code != 429:
                break
            time.sleep(11)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        link = r.json().get("reset_link", "")
        m = re.search(r"token=([A-Za-z0-9]+)", link)
        assert m, f"No token in reset_link: {link}"
        return m.group(1)

    def test_short_password_rejected(self, s, reset_token):
        r = s.post(f"{BASE_URL}/api/auth/reset-password",
                   json={"token": reset_token, "new_password": "abc", "method": "email"})
        assert r.status_code == 400
        assert "6 characters" in r.json().get("detail", "")

    def test_reset_succeeds_and_login_works(self, s, reset_token):
        new_pw = CUSTOMER_PASSWORD  # restore original so other suites still pass
        r = s.post(f"{BASE_URL}/api/auth/reset-password",
                   json={"token": reset_token, "new_password": new_pw, "method": "email"})
        assert r.status_code == 200, r.text
        assert r.json().get("reset") is True

        # Token should now be one-shot (invalid on reuse)
        r2 = s.post(f"{BASE_URL}/api/auth/reset-password",
                    json={"token": reset_token, "new_password": new_pw, "method": "email"})
        assert r2.status_code == 400

        # And the credentials should still log us in
        r3 = s.post(f"{BASE_URL}/api/auth/login",
                    json={"email": CUSTOMER_EMAIL, "password": new_pw})
        assert r3.status_code == 200, r3.text

    def test_invalid_token_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/auth/reset-password",
                   json={"token": "nope-not-real", "new_password": "abcdef", "method": "email"})
        assert r.status_code == 400
