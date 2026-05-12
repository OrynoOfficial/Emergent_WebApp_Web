"""
Tests for POST /api/users/create with send_invite=true (user invitation flow).
Mirrors the operator-owner invite tests in test_operator_invite_flow.py.
"""
import os
import sys
import uuid

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE_URL = os.environ.get("API_BASE_URL", "https://delivery-platform-108.preview.emergentagent.com")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def super_admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": "superadmin@oryno.com", "password": "testpassword123"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_admin_headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def first_operator_id(super_admin_headers):
    r = requests.get(f"{API}/operators/", headers=super_admin_headers, timeout=10)
    r.raise_for_status()
    data = r.json()
    ops = data.get("operators") if isinstance(data, dict) else data
    assert ops, "Need at least one operator in the DB to run these tests"
    return ops[0].get("_id") or ops[0].get("id")


def _unique_email(prefix="invite_user_test"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"


class TestUserInviteCreation:
    def test_create_customer_with_invite_returns_pending_state(self, super_admin_headers):
        email = _unique_email("cust")
        payload = {
            "email": email,
            "full_name": "Test Customer",
            "phone": "+237600000000",
            "role": "customer",
            "send_invite": True,
        }
        r = requests.post(f"{API}/users/create", json=payload, headers=super_admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["send_invite"] is True
        assert data["invite_link"], "invite_link must be returned even when email send fails (Resend sandbox)"
        assert "/verify-account?token=" in data["invite_link"]
        # admin did not set a password → default_password should NOT be exposed
        assert data["default_password"] is None

        # GET token info returns has_temp_password=false for invitee-set-own-password flow
        token = data["invite_link"].split("token=")[1]
        info = requests.get(f"{API}/auth/verify-account/{token}", timeout=10).json()
        assert info["email"] == email
        assert info["has_temp_password"] is False

    def test_create_operator_user_persists_operator_and_permissions(self, super_admin_headers, first_operator_id):
        email = _unique_email("staff")
        permissions = ["bookings.view", "services.view", "reports.view"]
        payload = {
            "email": email,
            "full_name": "Test Staff",
            "role": "operator",
            "operator_id": first_operator_id,
            "operator_role": "staff",
            "permissions": permissions,
            "send_invite": True,
            "password": "StartingPass123",  # admin-set starting pwd
        }
        r = requests.post(f"{API}/users/create", json=payload, headers=super_admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["send_invite"] is True
        assert data["default_password"] == "StartingPass123"

        token = data["invite_link"].split("token=")[1]
        info = requests.get(f"{API}/auth/verify-account/{token}", timeout=10).json()
        assert info["email"] == email
        assert info["has_temp_password"] is True
        # operator_name should appear in the invite info (used by the email template)
        assert info["operator_name"]

    def test_create_operator_without_operator_id_fails(self, super_admin_headers):
        payload = {
            "email": _unique_email("staff_no_op"),
            "full_name": "Missing Op",
            "role": "operator",
            "send_invite": True,
        }
        r = requests.post(f"{API}/users/create", json=payload, headers=super_admin_headers, timeout=10)
        assert r.status_code == 400
        assert "operator_id" in r.text.lower()

    def test_login_blocked_until_verified(self, super_admin_headers):
        email = _unique_email("login_block")
        r = requests.post(
            f"{API}/users/create",
            json={
                "email": email,
                "full_name": "Login Blocked",
                "role": "customer",
                "send_invite": True,
                "password": "MyStartPass1",
            },
            headers=super_admin_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        # Login should be blocked
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "MyStartPass1"}, timeout=10)
        assert lr.status_code == 403
        assert "confirm your account" in lr.json().get("detail", "").lower()

        # After verification login works
        token = r.json()["invite_link"].split("token=")[1]
        vr = requests.post(f"{API}/auth/verify-account", json={"token": token}, timeout=10)
        assert vr.status_code == 200
        lr2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "MyStartPass1"}, timeout=10)
        assert lr2.status_code == 200
        assert "access_token" in lr2.json()
